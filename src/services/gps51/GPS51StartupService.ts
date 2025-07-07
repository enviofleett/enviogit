import { gps51UnifiedAuthService } from './GPS51UnifiedAuthService';
import { gps51LiveDataService } from './GPS51LiveDataService';
import { gps51ProductionValidator } from './GPS51ProductionValidator';
import { gps51ProductionHealthMonitor } from './GPS51ProductionHealthMonitor';

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
      console.log('GPS51StartupService: Initializing unified authentication system...');
      
      // Use unified authentication service
      const authResult = await gps51UnifiedAuthService.initializeAuthentication();
      
      if (authResult) {
        console.log('GPS51StartupService: Unified authentication successful');
        this.isInitialized = true;
        this.systemInitialized = true;
        
        // Start live data system after successful authentication
        console.log('GPS51StartupService: Initializing production-ready live data system...');
        
        try {
          console.log('GPS51StartupService: Live data service ready (simplified architecture)');
          
          // Start production health monitoring
          console.log('GPS51StartupService: Starting production health monitoring...');
          gps51ProductionHealthMonitor.startMonitoring(60000); // Check every minute
          
        } catch (dataError) {
          console.warn('GPS51StartupService: Live data initialization failed, but authentication succeeded:', dataError);
        }
        
        return true;
      } else {
        console.error('GPS51StartupService: Unified authentication failed');
        return false;
      }
    } catch (error) {
      console.error('GPS51StartupService: Authentication initialization failed:', error);
      return false;
    }
  }

  async ensureAuthenticated(): Promise<boolean> {
    // First check if we're already authenticated
    if (this.isAuthenticated()) {
      console.log('GPS51StartupService: Already authenticated');
      return true;
    }

    console.log('GPS51StartupService: Authentication required, initializing...');
    const result = await this.initializeAuthentication();
    
    if (!result) {
      console.error('GPS51StartupService: Authentication failed during ensure check');
    }
    
    return result;
  }
  
  isAuthenticated(): boolean {
    const authenticated = gps51UnifiedAuthService.isCurrentlyAuthenticated() && this.isInitialized;
    console.log('GPS51StartupService: Authentication status check:', {
      unifiedAuthService: gps51UnifiedAuthService.isCurrentlyAuthenticated(),
      startupInitialized: this.isInitialized,
      overall: authenticated
    });
    return authenticated;
  }

  // Legacy compatibility methods
  async initialize(): Promise<boolean> {
    return await this.initializeAuthentication();
  }

  async refreshAuthentication(): Promise<boolean> {
    this.isInitialized = false;
    const refreshed = await gps51UnifiedAuthService.refreshAuthentication();
    if (refreshed) {
      this.isInitialized = true;
      this.systemInitialized = true;
    }
    return refreshed;
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
    // Return the simple live data service
    return gps51LiveDataService;
  }

  async getProductionHealthStatus() {
    // Get comprehensive health status including monitoring data
    return await gps51ProductionHealthMonitor.performHealthCheck();
  }

  reset(): void {
    this.isInitialized = false;
    this.systemInitialized = false;
    // Stop health monitoring
    gps51ProductionHealthMonitor.stopMonitoring();
  }
}

export const gps51StartupService = GPS51StartupService.getInstance();