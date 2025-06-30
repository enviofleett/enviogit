
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { gps51LiveDataService } from './GPS51LiveDataService';
import { gps51RealTimeActivationService } from './GPS51RealTimeActivationService';

export class GPS51StartupService {
  private static instance: GPS51StartupService;
  private initializationPromise: Promise<boolean> | null = null;
  private authService = GPS51AuthService.getInstance();

  static getInstance(): GPS51StartupService {
    if (!GPS51StartupService.instance) {
      GPS51StartupService.instance = new GPS51StartupService();
    }
    return GPS51StartupService.instance;
  }

  async initialize(): Promise<boolean> {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization(): Promise<boolean> {
    try {
      console.log('🚀 GPS51 Startup Service: Beginning initialization...');

      // Step 1: Check if GPS51 is configured
      const isConfigured = GPS51ConfigStorage.isConfigured();
      if (!isConfigured) {
        console.log('⚠️ GPS51 not configured, skipping initialization');
        return false;
      }

      // Step 2: Check if authentication is already valid
      const isAuthenticated = this.authService.isAuthenticated();
      const validToken = await this.authService.getValidToken();

      if (isAuthenticated && validToken) {
        console.log('✅ GPS51 authentication already valid, starting live data service...');
        await this.startLiveDataService();
        return true;
      }

      // Step 3: Attempt to restore authentication with stored credentials
      console.log('🔄 Attempting to restore GPS51 authentication...');
      const config = GPS51ConfigStorage.getConfiguration();
      
      if (config) {
        try {
          const credentials = {
            username: config.username,
            password: config.password,
            apiUrl: config.apiUrl,
            from: config.from,
            type: config.type,
            apiKey: config.apiKey
          };

          const token = await this.authService.authenticate(credentials);
          if (token) {
            console.log('✅ GPS51 authentication restored successfully');
            await this.startLiveDataService();
            return true;
          }
        } catch (error) {
          console.error('❌ Failed to restore GPS51 authentication:', error);
        }
      }

      console.log('⚠️ GPS51 authentication could not be restored');
      return false;

    } catch (error) {
      console.error('❌ GPS51 startup initialization failed:', error);
      return false;
    }
  }

  private async startLiveDataService(): Promise<void> {
    try {
      console.log('🔄 Starting GPS51 live data service...');

      // Start the live data service with 30-second polling
      gps51LiveDataService.updatePollingInterval(30000);
      
      // Begin continuous polling for live data
      gps51LiveDataService.startPolling((data) => {
        console.log(`📡 Live data update: ${data.devices.length} devices, ${data.positions.length} positions`);
        
        // Emit custom event for components to listen to
        window.dispatchEvent(new CustomEvent('gps51-live-data-update', {
          detail: data
        }));
      });

      // Also activate the real-time system
      const activationResult = await gps51RealTimeActivationService.activateRealTimeSystem();
      if (activationResult.success) {
        console.log('✅ GPS51 real-time system activated automatically');
      } else {
        console.warn('⚠️ GPS51 real-time system activation failed:', activationResult.message);
      }

      console.log('✅ GPS51 live data service started successfully');

    } catch (error) {
      console.error('❌ Failed to start GPS51 live data service:', error);
    }
  }

  async refreshAuthentication(): Promise<boolean> {
    try {
      console.log('🔄 Refreshing GPS51 authentication...');
      
      const refreshed = await this.authService.refreshToken();
      if (refreshed) {
        console.log('✅ GPS51 authentication refreshed successfully');
        return true;
      }

      // If refresh failed, try full re-authentication
      const config = GPS51ConfigStorage.getConfiguration();
      if (config) {
        const credentials = {
          username: config.username,
          password: config.password,
          apiUrl: config.apiUrl,
          from: config.from,
          type: config.type,
          apiKey: config.apiKey
        };

        const token = await this.authService.authenticate(credentials);
        if (token) {
          console.log('✅ GPS51 full re-authentication successful');
          return true;
        }
      }

      console.error('❌ GPS51 authentication refresh failed');
      return false;

    } catch (error) {
      console.error('❌ GPS51 authentication refresh error:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.authService.isAuthenticated();
  }

  getLiveDataService() {
    return gps51LiveDataService;
  }

  getActivationService() {
    return gps51RealTimeActivationService;
  }
}

// Export singleton
export const gps51StartupService = GPS51StartupService.getInstance();
