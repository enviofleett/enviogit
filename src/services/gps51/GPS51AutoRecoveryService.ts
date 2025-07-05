import { gps51DataRecoveryService } from './GPS51DataRecoveryService';
import { gps51DatabaseIntegration } from './GPS51DatabaseIntegration';
import { supabase } from '@/integrations/supabase/client';

export interface AutoRecoveryConfig {
  enabled: boolean;
  triggerThreshold: number; // Number of failed sync jobs before triggering recovery
  recoveryInterval: number; // Minutes between recovery attempts
  maxRecoveryAttempts: number; // Maximum recovery attempts per day
}

export interface AutoRecoveryResult {
  triggered: boolean;
  success: boolean;
  reason: string;
  devicesProcessed?: number;
  positionsRecovered?: number;
  nextAttemptAt?: string;
}

export class GPS51AutoRecoveryService {
  private static instance: GPS51AutoRecoveryService;
  private config: AutoRecoveryConfig;
  private recoveryAttempts = new Map<string, number>(); // date -> attempts count
  private lastRecoveryTime: number = 0;

  constructor(config: Partial<AutoRecoveryConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      triggerThreshold: config.triggerThreshold ?? 3,
      recoveryInterval: config.recoveryInterval ?? 30, // 30 minutes
      maxRecoveryAttempts: config.maxRecoveryAttempts ?? 5,
      ...config
    };
  }

  static getInstance(config?: Partial<AutoRecoveryConfig>): GPS51AutoRecoveryService {
    if (!GPS51AutoRecoveryService.instance) {
      GPS51AutoRecoveryService.instance = new GPS51AutoRecoveryService(config);
    }
    return GPS51AutoRecoveryService.instance;
  }

  /**
   * Check if auto recovery should be triggered based on recent sync job failures
   */
  async checkAndTriggerRecovery(): Promise<AutoRecoveryResult> {
    if (!this.config.enabled) {
      return {
        triggered: false,
        success: false,
        reason: 'Auto recovery is disabled'
      };
    }

    try {
      // Check if we're within the recovery interval
      const now = Date.now();
      const timeSinceLastRecovery = now - this.lastRecoveryTime;
      const intervalMs = this.config.recoveryInterval * 60 * 1000;

      if (timeSinceLastRecovery < intervalMs) {
        const nextAttemptAt = new Date(this.lastRecoveryTime + intervalMs);
        return {
          triggered: false,
          success: false,
          reason: `Recovery interval not met. Next attempt at ${nextAttemptAt.toISOString()}`,
          nextAttemptAt: nextAttemptAt.toISOString()
        };
      }

      // Check daily recovery limit
      const today = new Date().toDateString();
      const todayAttempts = this.recoveryAttempts.get(today) || 0;

      if (todayAttempts >= this.config.maxRecoveryAttempts) {
        return {
          triggered: false,
          success: false,
          reason: `Maximum daily recovery attempts reached (${this.config.maxRecoveryAttempts})`
        };
      }

      // Check recent sync job failures
      const recentFailures = await this.getRecentSyncJobFailures();
      
      if (recentFailures < this.config.triggerThreshold) {
        return {
          triggered: false,
          success: false,
          reason: `Failure threshold not met (${recentFailures}/${this.config.triggerThreshold})`
        };
      }

      console.log(`GPS51AutoRecoveryService: Triggering auto recovery due to ${recentFailures} recent failures`);

      // Trigger recovery
      const recoveryReport = await gps51DataRecoveryService.emergencyDataRecovery();
      
      // Update recovery tracking
      this.lastRecoveryTime = now;
      this.recoveryAttempts.set(today, todayAttempts + 1);

      // Log recovery to database
      await this.logRecoveryAttempt(true, recoveryReport.totalDevicesProcessed, recoveryReport.summary.positionsRecovered);

      return {
        triggered: true,
        success: true,
        reason: `Auto recovery completed successfully`,
        devicesProcessed: recoveryReport.totalDevicesProcessed,
        positionsRecovered: recoveryReport.summary.positionsRecovered
      };

    } catch (error) {
      console.error('GPS51AutoRecoveryService: Auto recovery failed:', error);
      
      // Log failed recovery attempt
      await this.logRecoveryAttempt(false, 0, 0, error instanceof Error ? error.message : 'Unknown error');

      return {
        triggered: true,
        success: false,
        reason: `Auto recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get count of recent sync job failures
   */
  private async getRecentSyncJobFailures(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('gps51_sync_jobs')
        .select('success')
        .gte('started_at', oneHourAgo)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Failed to query recent sync jobs:', error);
        return 0;
      }

      // Count consecutive failures from the most recent jobs
      let consecutiveFailures = 0;
      for (const job of data || []) {
        if (job.success === false) {
          consecutiveFailures++;
        } else {
          break; // Stop at first successful job
        }
      }

      return consecutiveFailures;
    } catch (error) {
      console.error('Error checking recent sync job failures:', error);
      return 0;
    }
  }

  /**
   * Log recovery attempt to audit trail
   */
  private async logRecoveryAttempt(
    success: boolean, 
    devicesProcessed: number, 
    positionsRecovered: number, 
    error?: string
  ): Promise<void> {
    try {
      const { error: logError } = await supabase
        .from('activity_logs')
        .insert({
          activity_type: 'auto_recovery',
          description: success 
            ? `Auto recovery completed: ${devicesProcessed} devices processed, ${positionsRecovered} positions recovered`
            : `Auto recovery failed: ${error}`,
          metadata: {
            success,
            devices_processed: devicesProcessed,
            positions_recovered: positionsRecovered,
            error_message: error,
            timestamp: new Date().toISOString()
          }
        });

      if (logError) {
        console.error('Failed to log recovery attempt:', logError);
      }
    } catch (logError) {
      console.error('Error logging recovery attempt:', logError);
    }
  }

  /**
   * Update auto recovery configuration
   */
  updateConfig(newConfig: Partial<AutoRecoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('GPS51AutoRecoveryService: Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoRecoveryConfig {
    return { ...this.config };
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    todayAttempts: number;
    maxDailyAttempts: number;
    timeSinceLastRecoveryMs: number;
    nextRecoveryAvailableAt: string;
  } {
    const today = new Date().toDateString();
    const todayAttempts = this.recoveryAttempts.get(today) || 0;
    const timeSinceLastRecovery = Date.now() - this.lastRecoveryTime;
    const intervalMs = this.config.recoveryInterval * 60 * 1000;
    const nextRecoveryTime = this.lastRecoveryTime + intervalMs;

    return {
      todayAttempts,
      maxDailyAttempts: this.config.maxRecoveryAttempts,
      timeSinceLastRecoveryMs: timeSinceLastRecovery,
      nextRecoveryAvailableAt: new Date(nextRecoveryTime).toISOString()
    };
  }

  /**
   * Reset recovery attempt counters (for testing or manual reset)
   */
  resetRecoveryCounters(): void {
    this.recoveryAttempts.clear();
    this.lastRecoveryTime = 0;
    console.log('GPS51AutoRecoveryService: Recovery counters reset');
  }

  /**
   * Check if auto recovery is enabled and configured
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable auto recovery
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`GPS51AutoRecoveryService: Auto recovery ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export singleton instance
export const gps51AutoRecoveryService = GPS51AutoRecoveryService.getInstance();