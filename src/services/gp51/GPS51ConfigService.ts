
import { GPS51Config, GPS51Credentials, SyncResult } from '../gps51/types';
import { gps51ConfigStorage } from '../gps51/GPS51ConfigStorage';
import { gps51SyncService } from '../gps51/GPS51SyncService';
import { GPS51AuthService } from './GPS51AuthService';

class GPS51ConfigService {
  private config: GPS51Config | null = null;
  private readonly authService = GPS51AuthService.getInstance();

  /**
   * Get GPS51 configuration
   */
  async getConfig(): Promise<GPS51Config | null> {
    console.log('GPS51ConfigService: Getting configuration...');

    // Return cached config if available
    if (this.config) {
      console.log('GPS51ConfigService: Using cached config');
      return this.config;
    }

    // Try to get from localStorage
    const stored = gps51ConfigStorage.getStoredConfig();
    if (stored) {
      this.config = stored;
      return this.config;
    }

    console.log('GPS51ConfigService: No configuration found');
    return null;
  }

  /**
   * Save GPS51 configuration
   */
  async setConfig(config: GPS51Config): Promise<void> {
    console.log('GPS51ConfigService: Saving configuration...');
    
    // Update memory cache
    this.config = config;
    
    // Save to localStorage
    gps51ConfigStorage.saveStoredConfig(config);
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
    gps51ConfigStorage.clearStoredConfig();
    
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
  async getCredentials(): Promise<GPS51Credentials> {
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
   * Sync data from GPS51 API (delegates to GPS51SyncService)
   */
  async syncData(): Promise<SyncResult> {
    return gps51SyncService.syncData();
  }
}

export const gps51ConfigService = new GPS51ConfigService();
