/**
 * GPS51 Production Authentication Manager
 * Single source of truth for all GPS51 authentication in production
 * Replaces all fragmented authentication systems
 */

import { GPS51ConfigStorage } from './configStorage';
import { gps51UnifiedService } from './unified/GPS51UnifiedService';

export interface GPS51ProductionAuthState {
  isAuthenticated: boolean;
  isConfigured: boolean;
  username: string | null;
  error: string | null;
  lastAuthTime: number | null;
  deviceCount: number;
  movingVehicles: number;
}

export class GPS51ProductionAuthManager {
  private static instance: GPS51ProductionAuthManager;

  static getInstance(): GPS51ProductionAuthManager {
    if (!GPS51ProductionAuthManager.instance) {
      GPS51ProductionAuthManager.instance = new GPS51ProductionAuthManager();
    }
    return GPS51ProductionAuthManager.instance;
  }

  /**
   * Get comprehensive authentication status
   */
  getAuthenticationStatus(): GPS51ProductionAuthState {
    const isConfigured = GPS51ConfigStorage.isConfigured();
    const unifiedAuthState = gps51UnifiedService.getAuthState();
    const serviceStatus = gps51UnifiedService.getServiceStatus();

    return {
      isAuthenticated: unifiedAuthState.isAuthenticated,
      isConfigured,
      username: unifiedAuthState.username,
      error: unifiedAuthState.error || null,
      lastAuthTime: Date.now(),
      deviceCount: serviceStatus.deviceCount,
      movingVehicles: serviceStatus.movingVehicles
    };
  }

  /**
   * Authenticate using stored credentials
   */
  async authenticateWithStoredCredentials(): Promise<GPS51ProductionAuthState> {
    try {
      const config = GPS51ConfigStorage.getConfiguration();
      if (!config) {
        throw new Error('No GPS51 credentials configured');
      }

      console.log('GPS51ProductionAuthManager: Authenticating with stored credentials...');
      
      const authResult = await gps51UnifiedService.authenticate(config.username, config.password);
      
      if (!authResult.isAuthenticated) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      console.log('GPS51ProductionAuthManager: Authentication successful');
      return this.getAuthenticationStatus();
    } catch (error) {
      console.error('GPS51ProductionAuthManager: Authentication failed:', error);
      return {
        ...this.getAuthenticationStatus(),
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Authenticate with credentials
   */
  async authenticate(username: string, password: string): Promise<GPS51ProductionAuthState> {
    try {
      console.log('GPS51ProductionAuthManager: Authenticating user:', username);
      
      // Save credentials first
      GPS51ConfigStorage.saveConfiguration({
        apiUrl: 'https://api.gps51.com/openapi',
        username,
        password,
        from: 'WEB',
        type: 'USER'
      });

      const authResult = await gps51UnifiedService.authenticate(username, password);
      
      if (!authResult.isAuthenticated) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      console.log('GPS51ProductionAuthManager: Authentication successful');
      return this.getAuthenticationStatus();
    } catch (error) {
      console.error('GPS51ProductionAuthManager: Authentication failed:', error);
      return {
        ...this.getAuthenticationStatus(),
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Logout and clear credentials
   */
  async logout(): Promise<void> {
    try {
      await gps51UnifiedService.logout();
      GPS51ConfigStorage.clearConfiguration();
      console.log('GPS51ProductionAuthManager: Logout successful');
    } catch (error) {
      console.error('GPS51ProductionAuthManager: Logout error:', error);
    }
  }

  /**
   * Check if system is ready for production
   */
  isProductionReady(): boolean {
    const status = this.getAuthenticationStatus();
    return status.isConfigured && status.isAuthenticated && !status.error;
  }
}

// Export singleton instance
export const gps51ProductionAuthManager = GPS51ProductionAuthManager.getInstance();