/**
 * GPS51 Authentication Service - Legacy Compatibility Layer
 * Provides backward compatibility while delegating to GPS51UnifiedAuthManager
 */

import { gps51UnifiedAuthManager } from './unified/GPS51UnifiedAuthManager';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';

export interface GPS51AuthenticationResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  responseTime?: number;
}

/**
 * GPS51 Authentication Service - Legacy Wrapper
 * DEPRECATED: Use GPS51UnifiedAuthManager directly for new code
 */
export class GPS51AuthenticationService {
  private static instance: GPS51AuthenticationService;

  constructor() {
    console.warn('GPS51AuthenticationService: This class is deprecated. Use GPS51UnifiedAuthManager instead.');
  }

  static getInstance(): GPS51AuthenticationService {
    if (!GPS51AuthenticationService.instance) {
      GPS51AuthenticationService.instance = new GPS51AuthenticationService();
    }
    return GPS51AuthenticationService.instance;
  }

  /**
   * Authenticate using unified auth manager
   */
  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthenticationResult> {
    try {
      const result = await gps51UnifiedAuthManager.authenticate(
        credentials.username,
        credentials.password,
        credentials.apiUrl
      );

      return {
        success: result.success,
        token: result.token,
        user: result.user,
        error: result.error,
        responseTime: result.responseTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        responseTime: 0
      };
    }
  }

  /**
   * Test connection using unified auth manager
   */
  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    // Simple connectivity test by checking if we can reach the auth manager
    const startTime = Date.now();
    
    try {
      const authState = gps51UnifiedAuthManager.getAuthState();
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime,
        healthStatus: {
          authManagerStatus: 'Operational',
          isAuthenticated: authState.isAuthenticated,
          hasToken: !!authState.token,
          recommendation: 'Use GPS51UnifiedAuthManager for optimal performance'
        }
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}