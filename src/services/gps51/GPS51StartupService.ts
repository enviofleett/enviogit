import { gps51AuthenticationService } from './GPS51AuthenticationService';
import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';
import { gps51LiveDataManager } from './GPS51LiveDataManager';

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
      return this.isAuthenticated();
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
      const authResult = await gps51AuthenticationService.authenticate(savedCredentials);
      
      if (authResult.success && authResult.token) {
        console.log('GPS51StartupService: Authentication successful');
        this.isInitialized = true;
        this.systemInitialized = true;
        
        // Store authentication token
        localStorage.setItem('gps51_auth_token', authResult.token);
        
        // Start live data system after successful authentication
        console.log('GPS51StartupService: Initializing live data system...');
        
        try {
          const initialized = await gps51LiveDataManager.initializeLiveDataSystem();
          if (initialized) {
            console.log('GPS51StartupService: Live data system initialized successfully');
            
            // Start enhanced polling with callback
            gps51LiveDataManager.startEnhancedPolling((data) => {
              console.log('GPS51StartupService: Live data update received:', {
                devices: data.devices.length,
                positions: data.positions.length,
                lastUpdate: data.lastUpdate
              });
              
              // Dispatch custom event for dashboard updates
              window.dispatchEvent(new CustomEvent('gps51-live-data-update', { detail: data }));
            });
            
            // Trigger initial data sync
            const initialData = await gps51LiveDataManager.forceLiveDataSync();
            console.log('GPS51StartupService: Initial data sync completed:', {
              devices: initialData.devices.length,
              positions: initialData.positions.length
            });
            
          } else {
            console.warn('GPS51StartupService: Live data system initialization failed');
          }
        } catch (dataError) {
          console.warn('GPS51StartupService: Live data initialization failed, but authentication succeeded:', dataError);
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
    if (this.isAuthenticated()) {
      return true;
    }

    return await this.initializeAuthentication();
  }
  
  isAuthenticated(): boolean {
    const token = localStorage.getItem('gps51_auth_token');
    return !!token && this.isInitialized;
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
      authenticated: this.isAuthenticated(),
      liveDataActive: this.isInitialized && this.isAuthenticated()
    };
  }

  async restart(): Promise<boolean> {
    this.reset();
    return await this.initializeAuthentication();
  }

  isSystemInitialized(): boolean {
    return this.systemInitialized;
  }

  getLiveDataManager() {
    // Return the enhanced live data manager
    return gps51LiveDataManager;
  }

  reset(): void {
    this.isInitialized = false;
    this.systemInitialized = false;
  }
}

export const gps51StartupService = GPS51StartupService.getInstance();