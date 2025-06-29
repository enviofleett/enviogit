
import { gps51Client } from './GPS51Client';

export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

class GPS51ConfigService {
  private config: GPS51Config | null = null;
  private readonly STORAGE_KEY = 'gps51_config';

  /**
   * Get GPS51 configuration from localStorage
   */
  async getConfig(): Promise<GPS51Config | null> {
    console.log('GPS51ConfigService: Getting configuration...');

    // Return cached config if available
    if (this.config) {
      console.log('GPS51ConfigService: Using cached config');
      return this.config;
    }

    try {
      // Get from localStorage
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        console.log('GPS51ConfigService: Found config in localStorage');
        this.config = JSON.parse(stored);
        return this.config;
      }
    } catch (error) {
      console.warn('GPS51ConfigService: Could not parse localStorage config:', error);
    }

    console.log('GPS51ConfigService: No configuration found');
    return null;
  }

  /**
   * Save GPS51 configuration to localStorage
   */
  async setConfig(config: GPS51Config): Promise<void> {
    console.log('GPS51ConfigService: Saving configuration...');
    
    // Ensure API URL uses the new openapi endpoint
    const updatedConfig = {
      ...config,
      apiUrl: config.apiUrl.replace('/webapi', '/openapi')
    };

    // Update memory cache
    this.config = updatedConfig;

    try {
      // Save to localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedConfig));
      console.log('GPS51ConfigService: Successfully saved to localStorage');
    } catch (error) {
      console.warn('GPS51ConfigService: Could not save to localStorage:', error);
      throw error;
    }
  }

  /**
   * Save configuration (alias for setConfig)
   */
  async saveConfiguration(config: GPS51Config): Promise<void> {
    return this.setConfig(config);
  }

  /**
   * Check if GPS51 is properly configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    const isConfigured = !!(
      config?.apiUrl && 
      config?.username && 
      config?.password &&
      config?.from &&
      config?.type
    );

    console.log('GPS51ConfigService: Configuration check:', {
      hasConfig: !!config,
      hasApiUrl: !!config?.apiUrl,
      hasUsername: !!config?.username,
      hasPassword: !!config?.password,
      hasFrom: !!config?.from,
      hasType: !!config?.type,
      isConfigured
    });

    return isConfigured;
  }

  /**
   * Synchronous check (uses cached config only)
   */
  isConfiguredSync(): boolean {
    const isConfigured = !!(
      this.config?.apiUrl && 
      this.config?.username && 
      this.config?.password &&
      this.config?.from &&
      this.config?.type
    );

    console.log('GPS51ConfigService: Sync configuration check:', {
      hasConfig: !!this.config,
      hasApiUrl: !!this.config?.apiUrl,
      hasUsername: !!this.config?.username,
      hasPassword: !!this.config?.password,
      hasFrom: !!this.config?.from,
      hasType: !!this.config?.type,
      isConfigured
    });

    return isConfigured;
  }

  /**
   * Clear all stored configuration
   */
  async clearConfig(): Promise<void> {
    console.log('GPS51ConfigService: Clearing configuration...');
    
    this.config = null;

    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('GPS51ConfigService: Could not clear localStorage:', error);
    }

    console.log('GPS51ConfigService: Configuration cleared');
  }

  /**
   * Clear configuration (alias for clearConfig)
   */
  async clearConfiguration(): Promise<void> {
    return this.clearConfig();
  }

  /**
   * Initialize configuration from authentication service
   */
  async initializeFromAuth(): Promise<void> {
    console.log('GPS51ConfigService: Initializing from authentication...');
    
    // Force reload configuration from storage
    this.config = null;
    await this.getConfig();
  }

  /**
   * Get configuration for API calls
   */
  async getCredentials() {
    const config = await this.getConfig();
    if (!config) {
      throw new Error('GPS51 not configured');
    }

    return {
      username: config.username,
      password: config.password,
      from: config.from,
      type: config.type,
      apiUrl: config.apiUrl
    };
  }

  /**
   * Sync data from GPS51 API
   */
  async syncData(): Promise<{ success: boolean; vehiclesSynced?: number; positionsStored?: number; error?: string }> {
    try {
      console.log('GPS51ConfigService: Starting data sync...');
      
      const config = await this.getConfig();
      if (!config) {
        throw new Error('GPS51 not configured');
      }

      // Get device list from GPS51
      const devices = await gps51Client.getDeviceList();
      console.log(`Found ${devices.length} GPS51 devices`);

      if (devices.length === 0) {
        return {
          success: true,
          vehiclesSynced: 0,
          positionsStored: 0
        };
      }

      // Get real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const positions = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`Retrieved ${positions.length} positions`);

      return {
        success: true,
        vehiclesSynced: devices.length,
        positionsStored: positions.length
      };

    } catch (error) {
      console.error('GPS51ConfigService: Sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }
}

export const gps51ConfigService = new GPS51ConfigService();
