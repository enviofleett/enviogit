import { gps51AuthService } from '../gp51/GPS51AuthService';
import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';
import { gps51LiveDataService } from './GPS51LiveDataService';

export class GPS51StartupService {
  private static instance: GPS51StartupService;
  private isInitialized = false;
  private systemInitialized = false;

  static getInstance(): GPS51StartupService {
    if (!GPS51StartupService.instance) {
      GPS51StartupService.instance = new GPS51StartupService();
    }
    return GPS51StartupService.instance;
  }

  async initializeAuthentication(): Promise<boolean> {
    if (this.isInitialized) {
      return gps51AuthService.isAuthenticated();
    }

    try {
      console.log('GPS51StartupService: Initializing authentication...');
      
      const credentialsManager = new GPS51CredentialsManager();
      const savedCredentials = await credentialsManager.getCredentials();
      
      if (!savedCredentials) {
        console.log('GPS51StartupService: No saved credentials found');
        return false;
      }

      console.log('GPS51StartupService: Found saved credentials, attempting authentication');
      
      // Use the enhanced authentication service
      const { gps51AuthenticationService } = await import('./GPS51AuthenticationService');
      const authResult = await gps51AuthenticationService.authenticate(savedCredentials);
      
      if (authResult.success && authResult.token) {
        console.log('GPS51StartupService: Authentication successful');
        this.isInitialized = true;
        this.systemInitialized = true;
        
        // Store authentication token
        localStorage.setItem('gps51_auth_token', authResult.token);
        
        // Start live data polling after successful authentication
        const liveDataService = this.getLiveDataService();
        console.log('GPS51StartupService: Starting live data polling...');
        
        // Start polling with callback
        liveDataService.startPolling((data) => {
          console.log('GPS51StartupService: Live data update received:', {
            devices: data.devices.length,
            positions: data.positions.length,
            lastUpdate: data.lastUpdate
          });
          
          // Dispatch custom event for dashboard updates
          window.dispatchEvent(new CustomEvent('gps51-live-data-update', { detail: data }));
        });
        
        // Trigger initial data fetch
        try {
          const initialData = await liveDataService.fetchLiveData();
          console.log('GPS51StartupService: Initial data fetch completed:', {
            devices: initialData.devices.length,
            positions: initialData.positions.length
          });
          
          // Dispatch initial data event
          window.dispatchEvent(new CustomEvent('gps51-live-data-update', { detail: initialData }));
        } catch (dataError) {
          console.warn('GPS51StartupService: Initial data fetch failed, but authentication succeeded:', dataError);
        }
        
        return true;
      } else {
        console.log('GPS51StartupService: Authentication failed with saved credentials:', authResult.error);
        return false;
      }
    } catch (error) {
      console.error('GPS51StartupService: Authentication initialization failed:', error);
      return false;
    }
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (gps51AuthService.isAuthenticated()) {
      return true;
    }

    return await this.initializeAuthentication();
  }

  // Legacy compatibility methods
  async initialize(): Promise<boolean> {
    return await this.initializeAuthentication();
  }

  async refreshAuthentication(): Promise<boolean> {
    this.isInitialized = false;
    return await this.initializeAuthentication();
  }

  getInitializationStatus(): { initialized: boolean; authenticated: boolean; liveDataActive: boolean } {
    return {
      initialized: this.isInitialized,
      authenticated: gps51AuthService.isAuthenticated(),
      liveDataActive: this.isInitialized && gps51AuthService.isAuthenticated()
    };
  }

  async restart(): Promise<boolean> {
    this.reset();
    return await this.initializeAuthentication();
  }

  isSystemInitialized(): boolean {
    return this.systemInitialized;
  }

  getLiveDataService() {
    // Return the actual live data service
    return gps51LiveDataService;
  }

  reset(): void {
    this.isInitialized = false;
    this.systemInitialized = false;
  }
}

export const gps51StartupService = GPS51StartupService.getInstance();