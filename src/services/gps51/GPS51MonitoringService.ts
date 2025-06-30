
import { supabase } from '@/integrations/supabase/client';

export interface GPS51HealthStatus {
  isHealthy: boolean;
  lastSuccessfulSync: Date | null;
  consecutiveFailures: number;
  currentError: string | null;
  apiResponseTime: number;
  positionDataRate: number; // positions per minute
  activeDeviceCount: number;
}

export class GPS51MonitoringService {
  private static instance: GPS51MonitoringService;
  private healthStatus: GPS51HealthStatus;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.healthStatus = {
      isHealthy: false,
      lastSuccessfulSync: null,
      consecutiveFailures: 0,
      currentError: null,
      apiResponseTime: 0,
      positionDataRate: 0,
      activeDeviceCount: 0
    };
  }

  static getInstance(): GPS51MonitoringService {
    if (!GPS51MonitoringService.instance) {
      GPS51MonitoringService.instance = new GPS51MonitoringService();
    }
    return GPS51MonitoringService.instance;
  }

  async startMonitoring(): Promise<void> {
    console.log('GPS51MonitoringService: Starting health monitoring...');
    
    // Initial health check
    await this.performHealthCheck();
    
    // Set up periodic health checks every 2 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 120000);
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('GPS51MonitoringService: Monitoring stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      console.log('GPS51MonitoringService: Performing health check...');
      
      // Check recent sync jobs
      const { data: recentSyncs, error: syncError } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (syncError) {
        throw new Error(`Failed to fetch sync jobs: ${syncError.message}`);
      }

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Find last successful sync
      const lastSuccessfulSync = recentSyncs
        ?.find(sync => sync.success && sync.completed_at)
        ?.completed_at;

      // Count consecutive failures
      let consecutiveFailures = 0;
      for (const sync of recentSyncs || []) {
        if (sync.success) break;
        consecutiveFailures++;
      }

      // Check if we have recent data
      const hasRecentSync = lastSuccessfulSync && 
        new Date(lastSuccessfulSync) > fiveMinutesAgo;

      // Check position data rate
      const { count: recentPositionCount } = await supabase
        .from('vehicle_positions')
        .select('*', { count: 'exact' })
        .gte('timestamp', thirtyMinutesAgo.toISOString());

      const positionDataRate = (recentPositionCount || 0) / 30; // positions per minute

      // Check active device count (devices with positions in last hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const { data: activeDevices } = await supabase
        .from('vehicle_positions')
        .select('vehicle_id')
        .gte('timestamp', oneHourAgo.toISOString())
        .group('vehicle_id');

      const activeDeviceCount = activeDevices?.length || 0;

      // Determine overall health
      const isHealthy = hasRecentSync && 
        consecutiveFailures < 3 && 
        positionDataRate > 0;

      // Get current error from most recent failed sync
      const currentError = !isHealthy && recentSyncs && recentSyncs.length > 0
        ? recentSyncs[0].error_message
        : null;

      // Calculate average response time from recent syncs
      const recentSyncTimes = recentSyncs
        ?.filter(sync => sync.execution_time_seconds)
        ?.slice(0, 5)
        ?.map(sync => sync.execution_time_seconds || 0) || [];
      
      const apiResponseTime = recentSyncTimes.length > 0
        ? recentSyncTimes.reduce((sum, time) => sum + time, 0) / recentSyncTimes.length * 1000
        : 0;

      // Update health status
      this.healthStatus = {
        isHealthy,
        lastSuccessfulSync: lastSuccessfulSync ? new Date(lastSuccessfulSync) : null,
        consecutiveFailures,
        currentError,
        apiResponseTime,
        positionDataRate,
        activeDeviceCount
      };

      console.log('GPS51MonitoringService: Health check completed', {
        isHealthy,
        consecutiveFailures,
        positionDataRate: positionDataRate.toFixed(2),
        activeDeviceCount,
        lastSuccessfulSync: lastSuccessfulSync ? new Date(lastSuccessfulSync).toISOString() : 'never'
      });

      // Emit health status update event
      window.dispatchEvent(new CustomEvent('gps51-health-update', {
        detail: this.healthStatus
      }));

      // Log critical issues
      if (!isHealthy) {
        console.warn('GPS51MonitoringService: System is unhealthy', {
          consecutiveFailures,
          currentError,
          positionDataRate
        });
        
        // Alert if no data for 15 minutes
        if (!lastSuccessfulSync || new Date(lastSuccessfulSync) < new Date(now.getTime() - 15 * 60 * 1000)) {
          console.error('GPS51MonitoringService: CRITICAL - No successful sync in 15+ minutes');
        }
      }

    } catch (error) {
      console.error('GPS51MonitoringService: Health check failed:', error);
      
      this.healthStatus.isHealthy = false;
      this.healthStatus.currentError = error instanceof Error ? error.message : 'Health check failed';
      this.healthStatus.consecutiveFailures++;
    }
  }

  getHealthStatus(): GPS51HealthStatus {
    return { ...this.healthStatus };
  }

  async triggerManualSync(): Promise<boolean> {
    try {
      console.log('GPS51MonitoringService: Triggering manual sync...');
      
      const { data, error } = await supabase.functions.invoke('gps51-live-sync');
      
      if (error) {
        throw new Error(`Manual sync failed: ${error.message}`);
      }

      console.log('GPS51MonitoringService: Manual sync completed', data);
      
      // Perform immediate health check to update status
      await this.performHealthCheck();
      
      return data?.success || false;
    } catch (error) {
      console.error('GPS51MonitoringService: Manual sync error:', error);
      return false;
    }
  }

  // Get system recommendations based on health status
  getSystemRecommendations(): string[] {
    const recommendations: string[] = [];
    const status = this.healthStatus;

    if (!status.isHealthy) {
      recommendations.push('System is experiencing issues - check GPS51 connectivity');
    }

    if (status.consecutiveFailures >= 3) {
      recommendations.push('Multiple sync failures detected - verify GPS51 credentials and API access');
    }

    if (status.positionDataRate < 1) {
      recommendations.push('Low position data rate - check if GPS51 devices are active and transmitting');
    }

    if (status.activeDeviceCount === 0) {
      recommendations.push('No active devices detected - verify GPS51 device connectivity');
    }

    if (status.apiResponseTime > 10000) {
      recommendations.push('High API response times detected - GPS51 server may be slow');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating normally');
    }

    return recommendations;
  }
}

export const gps51MonitoringService = GPS51MonitoringService.getInstance();
