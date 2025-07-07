import { supabase } from '@/integrations/supabase/client';

interface EmergencyState {
  isActive: boolean;
  reason: string;
  activatedAt: number;
  cooldownUntil: number;
}

export class GPS51EmergencyController {
  private static instance: GPS51EmergencyController;
  private state: EmergencyState = {
    isActive: false,
    reason: '',
    activatedAt: 0,
    cooldownUntil: 0
  };

  static getInstance(): GPS51EmergencyController {
    if (!GPS51EmergencyController.instance) {
      GPS51EmergencyController.instance = new GPS51EmergencyController();
    }
    return GPS51EmergencyController.instance;
  }

  /**
   * Activate emergency stop
   */
  async activateEmergencyStop(reason: string, cooldownMinutes: number = 30): Promise<void> {
    const now = Date.now();
    const cooldownUntil = now + (cooldownMinutes * 60 * 1000);

    this.state = {
      isActive: true,
      reason,
      activatedAt: now,
      cooldownUntil
    };

    console.error(`GPS51EmergencyController: Emergency stop activated - ${reason}`);

    // Update database
    try {
      await supabase
        .from('gps51_emergency_controls')
        .upsert({
          emergency_stop_active: true,
          reason,
          cooldown_until: new Date(cooldownUntil).toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('GPS51EmergencyController: Failed to update database:', error);
    }

    // Log emergency event
    this.logEmergencyEvent('emergency_activated', { reason, cooldownMinutes });
  }

  /**
   * Deactivate emergency stop (manual override)
   */
  async deactivateEmergencyStop(): Promise<void> {
    this.state = {
      isActive: false,
      reason: '',
      activatedAt: 0,
      cooldownUntil: 0
    };

    console.log('GPS51EmergencyController: Emergency stop manually deactivated');

    // Update database
    try {
      await supabase
        .from('gps51_emergency_controls')
        .upsert({
          emergency_stop_active: false,
          reason: 'Manual deactivation',
          cooldown_until: null,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('GPS51EmergencyController: Failed to update database:', error);
    }

    this.logEmergencyEvent('emergency_deactivated', { manual: true });
  }

  /**
   * Check if emergency stop is active
   */
  isEmergencyActive(): boolean {
    const now = Date.now();
    
    // Auto-deactivate if cooldown period has passed
    if (this.state.isActive && now >= this.state.cooldownUntil) {
      console.log('GPS51EmergencyController: Emergency stop auto-deactivated after cooldown');
      this.state.isActive = false;
      this.logEmergencyEvent('emergency_auto_deactivated', { 
        cooldownExpired: true,
        duration: now - this.state.activatedAt 
      });
    }

    return this.state.isActive;
  }

  /**
   * Get current emergency state
   */
  getEmergencyState(): EmergencyState & {
    remainingCooldown: number;
    isExpired: boolean;
  } {
    const now = Date.now();
    const remainingCooldown = Math.max(0, this.state.cooldownUntil - now);
    const isExpired = now >= this.state.cooldownUntil;

    return {
      ...this.state,
      remainingCooldown,
      isExpired
    };
  }

  /**
   * Load emergency state from database on startup
   */
  async loadEmergencyState(): Promise<void> {
    try {
      const { data } = await supabase
        .from('gps51_emergency_controls')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data && data.emergency_stop_active) {
        const cooldownUntil = data.cooldown_until ? new Date(data.cooldown_until).getTime() : 0;
        const now = Date.now();

        if (now < cooldownUntil) {
          this.state = {
            isActive: true,
            reason: data.reason || 'Database restored emergency stop',
            activatedAt: new Date(data.updated_at).getTime(),
            cooldownUntil
          };
          
          console.warn('GPS51EmergencyController: Restored active emergency stop from database');
        } else {
          // Expired, clean up database
          await this.deactivateEmergencyStop();
        }
      }
    } catch (error) {
      console.warn('GPS51EmergencyController: Failed to load emergency state:', error);
    }
  }

  /**
   * Handle 8902 rate limit errors specifically
   */
  async handle8902Error(): Promise<void> {
    await this.activateEmergencyStop(
      'GPS51 8902 rate limit error detected',
      15 // 15 minute cooldown for 8902 errors
    );
  }

  /**
   * Handle high failure rate
   */
  async handleHighFailureRate(failureCount: number): Promise<void> {
    await this.activateEmergencyStop(
      `High failure rate detected: ${failureCount} failures`,
      10 // 10 minute cooldown for high failure rate
    );
  }

  private async logEmergencyEvent(type: string, metadata: any): Promise<void> {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: 'GPS51-EmergencyController',
        method: type.toUpperCase(),
        request_payload: metadata || {},
        response_status: 200,
        response_body: JSON.parse(JSON.stringify(this.state)),
        duration_ms: 0,
        error_message: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('GPS51EmergencyController: Failed to log emergency event:', error);
    }
  }
}

export const gps51EmergencyController = GPS51EmergencyController.getInstance();