
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { gps51LiveDataService } from './GPS51LiveDataService';
import { gps51RealTimeActivationService } from './GPS51RealTimeActivationService';

export class GPS51StartupService {
  private static instance: GPS51StartupService;
  private initializationPromise: Promise<boolean> | null = null;
  private authService = GPS51AuthService.getInstance();
  private isInitialized = false;
  private initializationAttempts = 0;
  private maxInitializationAttempts = 3;

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
      this.initializationAttempts++;
      console.log(`🚀 GPS51 Startup Service: Beginning initialization attempt ${this.initializationAttempts}/${this.maxInitializationAttempts}...`);

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
        this.isInitialized = true;
        return true;
      }

      // Step 3: Attempt to restore authentication
      console.log('🔄 Attempting to restore GPS51 authentication...');
      const authManager = this.authService.getAuthManager();
      
      if (authManager && typeof authManager.restoreAuthentication === 'function') {
        const restored = await authManager.restoreAuthentication();
        
        if (restored) {
          console.log('✅ GPS51 authentication restored successfully');
          await this.startLiveDataService();
          this.isInitialized = true;
          return true;
        }
      }

      // Step 4: Fallback to config-based authentication
      console.log('🔄 Attempting config-based authentication fallback...');
      const config = GPS51ConfigStorage.getConfiguration();
      
      if (config && config.username && config.password) {
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
            console.log('✅ GPS51 authentication successful via config fallback');
            await this.startLiveDataService();
            this.isInitialized = true;
            return true;
          }
        } catch (error) {
          console.error('❌ Config-based authentication failed:', error);
        }
      }

      // Step 5: If we're here, authentication failed
      console.log('⚠️ GPS51 authentication could not be restored');
      
      // Try again if we haven't exceeded max attempts
      if (this.initializationAttempts < this.maxInitializationAttempts) {
        console.log(`🔄 Retrying initialization in 5 seconds (attempt ${this.initializationAttempts + 1}/${this.maxInitializationAttempts})...`);
        
        // Clear the promise so we can retry
        this.initializationPromise = null;
        
        // Retry after a delay
        setTimeout(() => {
          this.initialize();
        }, 5000);
      }
      
      return false;

    } catch (error) {
      console.error('❌ GPS51 startup initialization failed:', error);
      
      // Clear the promise so we can retry
      this.initializationPromise = null;
      
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
      throw error;
    }
  }

  async refreshAuthentication(): Promise<boolean> {
    try {
      console.log('🔄 Refreshing GPS51 authentication...');
      
      const refreshed = await this.authService.refreshToken();
      if (refreshed) {
        console.log('✅ GPS51 authentication refreshed successfully');
        
        // Ensure live data service is running
        if (this.isInitialized) {
          const serviceStatus = gps51LiveDataService.getServiceStatus();
          if (!serviceStatus.isPolling) {
            console.log('🔄 Restarting live data service after token refresh...');
            await this.startLiveDataService();
          }
        }
        
        return true;
      }

      // If refresh failed, try full re-initialization
      console.log('🔄 Token refresh failed, attempting full re-initialization...');
      this.isInitialized = false;
      this.initializationPromise = null;
      this.initializationAttempts = 0;
      
      return await this.initialize();

    } catch (error) {
      console.error('❌ GPS51 authentication refresh error:', error);
      return false;
    }
  }

  isSystemInitialized(): boolean {
    return this.isInitialized && this.authService.isAuthenticated();
  }

  getInitializationStatus(): {
    initialized: boolean;
    authenticated: boolean;
    liveDataActive: boolean;
    attempts: number;
    maxAttempts: number;
  } {
    const serviceStatus = gps51LiveDataService.getServiceStatus();
    
    return {
      initialized: this.isInitialized,
      authenticated: this.authService.isAuthenticated(),
      liveDataActive: serviceStatus.isPolling,
      attempts: this.initializationAttempts,
      maxAttempts: this.maxInitializationAttempts
    };
  }

  getLiveDataService() {
    return gps51LiveDataService;
  }

  getActivationService() {
    return gps51RealTimeActivationService;
  }

  // Force restart the entire system
  async restart(): Promise<boolean> {
    console.log('🔄 Force restarting GPS51 system...');
    
    // Stop current services
    gps51LiveDataService.stopPolling();
    this.authService.logout();
    
    // Reset state
    this.isInitialized = false;
    this.initializationPromise = null;
    this.initializationAttempts = 0;
    
    // Restart
    return await this.initialize();
  }
}

// Export singleton
export const gps51StartupService = GPS51StartupService.getInstance();
