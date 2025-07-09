import { GPS51AuthCredentials } from './GPS51Types';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';

/**
 * Core GPS51 authentication logic
 */
export class GPS51AuthenticationCore {
  /**
   * Perform authentication with credentials
   */
  async authenticate(credentials: GPS51AuthCredentials): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: any;
    strategy?: string;
    responseTime?: number;
  }> {
    try {
      console.log('GPS51AuthenticationCore: Starting authentication...');

      if (!credentials) {
        return {
          success: false,
          error: 'No credentials available. Please configure GPS51 credentials first.'
        };
      }

      console.log('GPS51AuthenticationCore: Using credentials:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type
      });

      // Use intelligent connection manager for robust authentication
      const connectionResult = await gps51IntelligentConnectionManager.connectWithBestStrategy(credentials);

      if (connectionResult.success && connectionResult.token) {
        console.log('GPS51AuthenticationCore: Authentication successful via', connectionResult.strategy);

        return {
          success: true,
          token: connectionResult.token,
          user: connectionResult.user,
          strategy: connectionResult.strategy,
          responseTime: connectionResult.responseTime
        };
      } else {
        return {
          success: false,
          error: connectionResult.error || 'Authentication failed',
          strategy: connectionResult.strategy,
          responseTime: connectionResult.responseTime
        };
      }
    } catch (error) {
      console.error('GPS51AuthenticationCore: Authentication failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  /**
   * Validate credentials format
   */
  validateCredentials(credentials: GPS51AuthCredentials): { valid: boolean; error?: string } {
    if (!credentials.username || !credentials.password || !credentials.apiUrl) {
      return {
        valid: false,
        error: 'Username, password, and API URL are required'
      };
    }

    if (!credentials.from) {
      credentials.from = 'WEB';
    }

    if (!credentials.type) {
      credentials.type = 'USER';
    }

    return { valid: true };
  }
}