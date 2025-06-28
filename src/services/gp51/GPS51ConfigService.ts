
import { GPS51AuthService, GPS51Credentials } from './GPS51AuthService';
import { supabase } from '@/integrations/supabase/client';

export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  apiKey: string;
}

export interface GPS51SyncResult {
  success: boolean;
  vehiclesSynced: number;
  positionsStored: number;
  error?: string;
}

export class GPS51ConfigService {
  private static instance: GPS51ConfigService;
  private authService = GPS51AuthService.getInstance();

  static getInstance(): GPS51ConfigService {
    if (!GPS51ConfigService.instance) {
      GPS51ConfigService.instance = new GPS51ConfigService();
    }
    return GPS51ConfigService.instance;
  }

  async saveConfiguration(config: GPS51Config): Promise<void> {
    try {
      // Store configuration in localStorage
      localStorage.setItem('gps51_api_url', config.apiUrl);
      localStorage.setItem('gps51_username', config.username);
      localStorage.setItem('gps51_password', config.password);
      localStorage.setItem('gps51_api_key', config.apiKey);

      // Store credentials for auth service (without password for security)
      localStorage.setItem('gps51_credentials', JSON.stringify({
        username: config.username,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl
      }));

      console.log('GPS51 configuration saved successfully');
    } catch (error) {
      console.error('Failed to save GPS51 configuration:', error);
      throw new Error('Failed to save configuration');
    }
  }

  getConfiguration(): GPS51Config | null {
    try {
      const apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const password = localStorage.getItem('gps51_password');
      const apiKey = localStorage.getItem('gps51_api_key');

      if (apiUrl && username && password && apiKey) {
        return {
          apiUrl,
          username,
          password,
          apiKey
        };
      }
    } catch (error) {
      console.error('Failed to load GPS51 configuration:', error);
    }

    return null;
  }

  async testConnection(config: GPS51Config): Promise<boolean> {
    try {
      const credentials: GPS51Credentials = {
        username: config.username,
        password: config.password,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl
      };

      const token = await this.authService.authenticate(credentials);
      return !!token.access_token;
    } catch (error) {
      console.error('GPS51 connection test failed:', error);
      throw error;
    }
  }

  async syncData(): Promise<GPS51SyncResult> {
    try {
      // Get valid token
      const token = await this.authService.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      // Get configuration
      const config = this.getConfiguration();
      if (!config) {
        throw new Error('No GPS51 configuration found');
      }

      // Call sync edge function with dynamic configuration
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          apiUrl: config.apiUrl,
          accessToken: token
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Sync operation failed');
      }

      return {
        success: true,
        vehiclesSynced: data.vehiclesSynced || 0,
        positionsStored: data.positionsStored || 0
      };

    } catch (error) {
      console.error('GPS51 sync failed:', error);
      return {
        success: false,
        vehiclesSynced: 0,
        positionsStored: 0,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  isConfigured(): boolean {
    const config = this.getConfiguration();
    return !!(config?.apiUrl && config?.username && config?.password && config?.apiKey);
  }

  clearConfiguration(): void {
    localStorage.removeItem('gps51_api_url');
    localStorage.removeItem('gps51_username');
    localStorage.removeItem('gps51_password');
    localStorage.removeItem('gps51_api_key');
    localStorage.removeItem('gps51_credentials');
    this.authService.logout();
    console.log('GPS51 configuration cleared');
  }
}

export const gps51ConfigService = GPS51ConfigService.getInstance();
