import { gps51AuthService } from '../gp51/GPS51AuthService';
import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';

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
      const savedCredentials = credentialsManager.getCredentials();
      
      if (!savedCredentials) {
        console.log('GPS51StartupService: No saved credentials found');
        return false;
      }

      console.log('GPS51StartupService: Found saved credentials, attempting authentication');
      const authResult = await gps51AuthService.authenticate(savedCredentials);
      
      if (authResult) {
        console.log('GPS51StartupService: Authentication successful');
        this.isInitialized = true;
        return true;
      } else {
        console.log('GPS51StartupService: Authentication failed with saved credentials');
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

  getLiveDataService(): any {
    // Import and return live data service using dynamic import
    import('./GPS51LiveDataService').then(module => {
      return module.gps51LiveDataService;
    });
    // For now, return a mock object to prevent errors
    return {
      getServiceStatus: () => ({ isPolling: false, retryCount: 0, stateStats: { totalDevices: 0, totalPositions: 0, lastUpdate: new Date() } }),
      getCurrentState: () => ({ devices: [], positions: [], lastUpdate: new Date(), lastQueryPositionTime: 0 })
    };
  }

  reset(): void {
    this.isInitialized = false;
    this.systemInitialized = false;
  }
}

export const gps51StartupService = GPS51StartupService.getInstance();