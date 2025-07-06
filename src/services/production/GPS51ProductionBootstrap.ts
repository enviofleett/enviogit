import { gps51StartupService } from '@/services/gps51/GPS51StartupService';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { productionMonitoringService } from '@/services/monitoring/ProductionMonitoringService';
import { getEnvironmentConfig, isProduction } from '@/config/environment';

export interface ProductionBootstrapResult {
  success: boolean;
  authenticated: boolean;
  systemReady: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Production Bootstrap Service
 * Handles initial system startup and production readiness verification
 */
export class GPS51ProductionBootstrap {
  private static instance: GPS51ProductionBootstrap;
  private bootstrapStarted = false;
  private bootstrapCompleted = false;
  
  static getInstance(): GPS51ProductionBootstrap {
    if (!GPS51ProductionBootstrap.instance) {
      GPS51ProductionBootstrap.instance = new GPS51ProductionBootstrap();
    }
    return GPS51ProductionBootstrap.instance;
  }

  async initializeProductionSystem(): Promise<ProductionBootstrapResult> {
    if (this.bootstrapStarted) {
      console.log('GPS51ProductionBootstrap: Bootstrap already in progress');
      return this.getBootstrapStatus();
    }

    this.bootstrapStarted = true;
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('GPS51ProductionBootstrap: Starting production system initialization...');

      // Phase 1: Validate environment configuration
      const envValidation = await this.validateEnvironmentConfiguration();
      if (!envValidation.valid) {
        errors.push(`Environment validation failed: ${envValidation.error}`);
      }

      // Phase 2: Initialize GPS51 authentication
      let authenticated = false;
      try {
        console.log('GPS51ProductionBootstrap: Initializing GPS51 authentication...');
        authenticated = await gps51StartupService.initializeAuthentication();
        
        if (!authenticated) {
          const config = gps51ConfigService.getConfiguration();
          if (!config) {
            errors.push('GPS51 credentials not configured');
          } else {
            warnings.push('GPS51 authentication failed - check credentials');
          }
        } else {
          console.log('GPS51ProductionBootstrap: GPS51 authentication successful');
        }
      } catch (error) {
        errors.push(`GPS51 authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Phase 3: Initialize production monitoring
      try {
        console.log('GPS51ProductionBootstrap: Initializing production monitoring...');
        await productionMonitoringService.initialize();
        console.log('GPS51ProductionBootstrap: Production monitoring initialized');
      } catch (error) {
        warnings.push(`Monitoring initialization warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Phase 4: Validate system readiness
      const systemReady = authenticated && errors.length === 0;

      // Phase 5: Log bootstrap results
      const result: ProductionBootstrapResult = {
        success: errors.length === 0,
        authenticated,
        systemReady,
        errors,
        warnings
      };

      console.log('GPS51ProductionBootstrap: Bootstrap completed', result);
      this.bootstrapCompleted = true;

      // Phase 6: Start continuous health monitoring if production ready
      if (systemReady && isProduction()) {
        this.startProductionHealthMonitoring();
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown bootstrap error';
      console.error('GPS51ProductionBootstrap: Critical bootstrap failure:', error);
      
      return {
        success: false,
        authenticated: false,
        systemReady: false,
        errors: [...errors, `Bootstrap failure: ${errorMessage}`],
        warnings
      };
    }
  }

  private async validateEnvironmentConfiguration(): Promise<{ valid: boolean; error?: string }> {
    try {
      const config = getEnvironmentConfig();
      
      // Validate required configuration exists
      if (!config) {
        return { valid: false, error: 'Environment configuration not found' };
      }

      // Validate GPS51 configuration exists
      const gps51Config = gps51ConfigService.getConfiguration();
      if (!gps51Config) {
        return { valid: false, error: 'GPS51 configuration required for production' };
      }

      // Validate required GPS51 fields
      if (!gps51Config.username || !gps51Config.password || !gps51Config.apiUrl) {
        return { valid: false, error: 'GPS51 credentials incomplete' };
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: `Environment validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private startProductionHealthMonitoring(): void {
    console.log('GPS51ProductionBootstrap: Starting production health monitoring...');
    
    // Set up periodic system health checks
    setInterval(async () => {
      try {
        const authStatus = gps51StartupService.isAuthenticated();
        if (!authStatus) {
          console.warn('GPS51ProductionBootstrap: GPS51 authentication lost, attempting recovery...');
          await this.attemptAuthenticationRecovery();
        }
      } catch (error) {
        console.error('GPS51ProductionBootstrap: Health monitoring error:', error);
      }
    }, 60000); // Check every minute in production
  }

  private async attemptAuthenticationRecovery(): Promise<void> {
    try {
      console.log('GPS51ProductionBootstrap: Attempting authentication recovery...');
      const recovered = await gps51StartupService.initializeAuthentication();
      
      if (recovered) {
        console.log('GPS51ProductionBootstrap: Authentication recovery successful');
      } else {
        console.error('GPS51ProductionBootstrap: Authentication recovery failed');
      }
    } catch (error) {
      console.error('GPS51ProductionBootstrap: Authentication recovery error:', error);
    }
  }

  private getBootstrapStatus(): ProductionBootstrapResult {
    return {
      success: this.bootstrapCompleted,
      authenticated: gps51StartupService.isAuthenticated(),
      systemReady: this.bootstrapCompleted && gps51StartupService.isAuthenticated(),
      errors: [],
      warnings: []
    };
  }

  public isSystemReady(): boolean {
    return this.bootstrapCompleted && gps51StartupService.isAuthenticated();
  }

  public getSystemStatus(): {
    bootstrapCompleted: boolean;
    authenticated: boolean;
    systemReady: boolean;
  } {
    return {
      bootstrapCompleted: this.bootstrapCompleted,
      authenticated: gps51StartupService.isAuthenticated(),
      systemReady: this.isSystemReady()
    };
  }
}

export const gps51ProductionBootstrap = GPS51ProductionBootstrap.getInstance();