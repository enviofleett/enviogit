
import { GPS51Service, GPS51Credentials } from './GPS51Service';

export class GPS51ConfigurationManager {
  private static instance: GPS51ConfigurationManager;
  private service: GPS51Service | null = null;

  private constructor() {}

  static getInstance(): GPS51ConfigurationManager {
    if (!GPS51ConfigurationManager.instance) {
      GPS51ConfigurationManager.instance = new GPS51ConfigurationManager();
    }
    return GPS51ConfigurationManager.instance;
  }

  async configure(credentials: GPS51Credentials): Promise<void> {
    console.log('=== GPS51 CONFIGURATION ===');
    console.log('Configuring GPS51 service with credentials:', {
      apiUrl: credentials.apiUrl,
      username: credentials.username,
      hasPassword: !!credentials.password,
      loginFrom: credentials.loginFrom,
      loginType: credentials.loginType
    });

    // Validate credentials by creating a service instance
    try {
      this.service = new GPS51Service(credentials);
      
      // Test the configuration by attempting login
      await this.service.login();
      
      // Store credentials in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('gps51_api_url', credentials.apiUrl);
        localStorage.setItem('gps51_username', credentials.username);
        localStorage.setItem('gps51_password_hash', credentials.password);
        localStorage.setItem('gps51_from', credentials.loginFrom);
        localStorage.setItem('gps51_type', credentials.loginType);
        
        // Store configuration timestamp
        localStorage.setItem('gps51_configured_at', new Date().toISOString());
      }
      
      console.log('✅ GPS51 configuration successful');
    } catch (error) {
      console.error('❌ GPS51 configuration failed:', error);
      this.service = null;
      throw error;
    }
  }

  getService(): GPS51Service | null {
    if (!this.service) {
      try {
        this.service = new GPS51Service();
      } catch (error) {
        console.warn('GPS51 service not configured:', error);
        return null;
      }
    }
    return this.service;
  }

  isConfigured(): boolean {
    return GPS51Service.isConfigured();
  }

  getConfigurationStatus() {
    if (!this.service) {
      try {
        this.service = new GPS51Service();
      } catch {
        return {
          isConfigured: false,
          missingCredentials: ['apiUrl', 'username', 'password'],
          apiUrl: '',
          username: ''
        };
      }
    }
    
    return this.service.getConfigurationStatus();
  }

  clearConfiguration(): void {
    console.log('Clearing GPS51 configuration...');
    
    this.service = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gps51_api_url');
      localStorage.removeItem('gps51_username');
      localStorage.removeItem('gps51_password_hash');
      localStorage.removeItem('gps51_from');
      localStorage.removeItem('gps51_type');
      localStorage.removeItem('gps51_configured_at');
    }
    
    console.log('✅ GPS51 configuration cleared');
  }

  async testConnection(): Promise<{ success: boolean; error?: string; deviceCount?: number }> {
    try {
      const service = this.getService();
      if (!service) {
        return { success: false, error: 'GPS51 service not configured' };
      }

      const devices = await service.getDeviceList();
      return { 
        success: true, 
        deviceCount: devices.length 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const gps51ConfigManager = GPS51ConfigurationManager.getInstance();
