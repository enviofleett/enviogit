
import { GPS51AuthService, GPS51Credentials } from './GPS51AuthService';
import { GPS51Config, GPS51SyncResult } from '../gps51/interfaces';
import { GPS51ConfigStorage } from '../gps51/configStorage';
import { GPS51DataSyncService } from '../gps51/dataSyncService';

export class GPS51ConfigService {
  private static instance: GPS51ConfigService;
  private authService = GPS51AuthService.getInstance();
  private dataSyncService = new GPS51DataSyncService();

  static getInstance(): GPS51ConfigService {
    if (!GPS51ConfigService.instance) {
      GPS51ConfigService.instance = new GPS51ConfigService();
    }
    return GPS51ConfigService.instance;
  }

  async saveConfiguration(config: GPS51Config): Promise<void> {
    try {
      console.log('GPS51ConfigService: Saving configuration...');
      
      // Validate required fields
      if (!config.apiUrl || !config.username || !config.password) {
        throw new Error('Missing required configuration fields');
      }

      GPS51ConfigStorage.saveConfiguration(config);
    } catch (error) {
      console.error('GPS51ConfigService: Failed to save configuration:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getConfiguration(): GPS51Config | null {
    return GPS51ConfigStorage.getConfiguration();
  }

  async testConnection(config: GPS51Config): Promise<boolean> {
    try {
      console.log('GPS51ConfigService: Testing connection...');
      
      const credentials: GPS51Credentials = {
        username: config.username,
        password: config.password,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        from: config.from || 'WEB',
        type: config.type || 'USER'
      };

      const token = await this.authService.authenticate(credentials);
      const isValid = !!token.access_token;
      
      console.log('GPS51ConfigService: Connection test result:', {
        success: isValid,
        hasToken: !!token.access_token
      });
      
      return isValid;
    } catch (error) {
      console.error('GPS51ConfigService: Connection test failed:', error);
      throw error;
    }
  }

  async syncData(): Promise<GPS51SyncResult> {
    return this.dataSyncService.syncData();
  }

  isConfigured(): boolean {
    return GPS51ConfigStorage.isConfigured();
  }

  clearConfiguration(): void {
    GPS51ConfigStorage.clearConfiguration();
    this.authService.logout();
    console.log('GPS51ConfigService: Configuration cleared');
  }
}

export const gps51ConfigService = GPS51ConfigService.getInstance();

// Re-export interfaces for backward compatibility
export type { GPS51Config, GPS51SyncResult } from '../gps51/interfaces';
