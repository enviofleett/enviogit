
import { supabase } from '@/integrations/supabase/client';

export interface PollingConfig {
  interval: number;
  enabled: boolean;
  priority: number;
}

export class GPS51PollingService {
  private static instance: GPS51PollingService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private config: PollingConfig = {
    interval: 10000, // 10 seconds default
    enabled: false,
    priority: 1
  };
  private isPolling = false;

  private constructor() {}

  static getInstance(): GPS51PollingService {
    if (!GPS51PollingService.instance) {
      GPS51PollingService.instance = new GPS51PollingService();
    }
    return GPS51PollingService.instance;
  }

  async startPolling(config?: Partial<PollingConfig>): Promise<void> {
    if (this.isPolling) {
      console.log('GPS51 polling already active');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (!this.config.enabled) {
      console.log('GPS51 polling disabled in config');
      return;
    }

    console.log('Starting GPS51 polling with config:', this.config);
    this.isPolling = true;

    // Start immediate sync
    await this.syncData();

    // Set up polling interval
    this.pollingInterval = setInterval(async () => {
      if (this.config.enabled && this.isPolling) {
        await this.syncData();
      }
    }, this.config.interval);
  }

  stopPolling(): void {
    console.log('Stopping GPS51 polling');
    this.isPolling = false;
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  updateConfig(config: Partial<PollingConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    console.log('GPS51 polling config updated:', { old: oldConfig, new: this.config });

    // Restart polling if interval changed
    if (this.isPolling && oldConfig.interval !== this.config.interval) {
      this.stopPolling();
      this.startPolling();
    }
  }

  private async syncData(): Promise<void> {
    try {
      console.log('GPS51 polling: Triggering sync...');
      
      // Get credentials from localStorage
      const credentials = this.getStoredCredentials();
      if (!credentials) {
        console.warn('GPS51 polling: No credentials available');
        return;
      }

      // Call the GPS51 sync edge function
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          ...credentials,
          priority: this.config.priority,
          cronTriggered: true
        }
      });

      if (error) {
        console.error('GPS51 polling sync error:', error);
        return;
      }

      if (data?.success) {
        console.log('GPS51 polling sync successful:', {
          vehiclesSynced: data.vehiclesSynced,
          positionsStored: data.positionsStored,
          executionTime: data.executionTimeSeconds
        });
      } else {
        console.warn('GPS51 polling sync failed:', data?.error);
      }

    } catch (error) {
      console.error('GPS51 polling: Unexpected error during sync:', error);
    }
  }

  private getStoredCredentials(): { username: string; password: string; apiUrl: string } | null {
    try {
      const username = localStorage.getItem('gps51_username');
      const password = localStorage.getItem('gps51_password_hash');
      const apiUrl = localStorage.getItem('gps51_api_url');

      if (username && password && apiUrl) {
        return { username, password, apiUrl };
      }
    } catch (error) {
      console.error('Failed to get stored GPS51 credentials:', error);
    }
    
    return null;
  }

  isActive(): boolean {
    return this.isPolling;
  }

  getConfig(): PollingConfig {
    return { ...this.config };
  }
}

export const gps51PollingService = GPS51PollingService.getInstance();
