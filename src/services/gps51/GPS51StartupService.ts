import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';
import { gps51LiveDataManager } from './GPS51LiveDataManager';
import { gps51ProductionValidator } from './GPS51ProductionValidator';

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
      console.log('GPS51StartupService: Initializing production-ready authentication system...');
      
      const credentialsManager = new GPS51CredentialsManager();
      const savedCredentials = await credentialsManager.getCredentials();
      
      if (!savedCredentials) {
        console.warn('GPS51StartupService: No saved credentials found - credentials manager should have set defaults');
        return false;
      }
      
      console.log('GPS51StartupService: Credentials loaded:', {
        username: savedCredentials.username,
        hasPassword: !!savedCredentials.password,
        apiUrl: savedCredentials.apiUrl,
        from: savedCredentials.from,
        type: savedCredentials.type
      });

      console.log('GPS51StartupService: Using intelligent connection manager for authentication...');
      
      // Use intelligent connection manager for robust authentication
      const connectionResult = await gps51IntelligentConnectionManager.connectWithBestStrategy(savedCredentials);
      
      if (connectionResult.success && connectionResult.token) {
        console.log('GPS51StartupService: Authentication successful via', connectionResult.strategy);
        this.isInitialized = true;
        this.systemInitialized = true;
        
        // Store authentication token
        localStorage.setItem('gps51_auth_token', connectionResult.token);
        
        // Start live data system after successful authentication
        console.log('GPS51StartupService: Initializing production-ready live data system...');
        
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
        console.error('GPS51StartupService: Authentication failed:', {
          error: connectionResult.error,
          strategy: connectionResult.strategy,
          responseTime: connectionResult.responseTime
        });
        
        // Add troubleshooting information
        console.log('GPS51StartupService: Troubleshooting information:', {
          credentials: {
            username: savedCredentials.username,
            hasPassword: !!savedCredentials.password,
            apiUrl: savedCredentials.apiUrl
          },
          connectionHealth: gps51IntelligentConnectionManager.getConnectionHealth()
        });
        
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

  getInitializationStatus(): { initialized: boolean; authenticated: boolean; liveDataActive: boolean; productionReady: boolean } {
    return {
      initialized: this.isInitialized,
      authenticated: this.isAuthenticated(),
      liveDataActive: this.isInitialized && this.isAuthenticated(),
      productionReady: this.systemInitialized
    };
  }

  async getProductionReadinessReport() {
    return await gps51ProductionValidator.runCompleteValidation();
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