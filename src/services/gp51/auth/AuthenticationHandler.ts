
import { gps51Client } from '../../gps51/GPS51Client';
import type { GPS51Credentials, GPS51AuthToken } from './types';

export class AuthenticationHandler {
  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthToken> {
    try {
      console.log('GPS51AuthService: Starting authentication...');
      
      // Use only the username parameter as the client expects
      const result = await gps51Client.authenticate(credentials.username);

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      const token: GPS51AuthToken = {
        access_token: gps51Client.getToken() || '',
        token_type: 'Bearer',
        expires_in: 24 * 60 * 60, // 24 hours
        expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000))
      };
      
      console.log('GPS51AuthService: Authentication successful');
      return token;

    } catch (error) {
      console.error('GPS51AuthService: Authentication failed:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    try {
      // Try to refresh using the GPS51 client
      const refreshSuccess = await gps51Client.refreshToken();
      if (refreshSuccess) {
        // Token is still valid, update expiry
        const token: GPS51AuthToken = {
          access_token: gps51Client.getToken() || '',
          token_type: 'Bearer',
          expires_in: 24 * 60 * 60,
          expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000))
        };
        
        return token;
      } else {
        // Need full re-authentication
        return null;
      }
    } catch (error) {
      console.error('Failed to refresh GPS51 token:', error);
      return null;
    }
  }
}
