
import { gps51Client, GPS51AuthCredentials } from '../gps51/GPS51Client';
import { GPS51TokenManager, GPS51AuthToken } from './GPS51TokenManager';
import { GPS51CredentialsManager, GPS51Credentials } from './GPS51CredentialsManager';

export class GPS51AuthManager {
  private tokenManager = new GPS51TokenManager();
  private credentialsManager = new GPS51CredentialsManager();

  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthToken> {
    try {
      console.log('GPS51AuthManager: Starting authentication...');
      
      const authCredentials: GPS51AuthCredentials = {
        username: credentials.username,
        password: credentials.password, // Should already be MD5 hashed
        apiUrl: credentials.apiUrl,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      };

      const result = await gps51Client.authenticate(authCredentials);

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      const token = this.tokenManager.setToken({
        access_token: gps51Client.getToken() || '',
        expires_in: 24 * 60 * 60 // 24 hours
      });

      this.credentialsManager.setCredentials(credentials);
      
      console.log('GPS51AuthManager: Authentication successful');
      return token;

    } catch (error) {
      console.error('GPS51AuthManager: Authentication failed:', error);
      this.logout();
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getValidToken(): Promise<string | null> {
    return this.tokenManager.getValidToken();
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    try {
      // Try to refresh using the GPS51 client
      const refreshSuccess = await gps51Client.refreshToken();
      if (refreshSuccess) {
        // Token is still valid, update expiry
        const token = this.tokenManager.setToken({
          access_token: gps51Client.getToken() || '',
          expires_in: 24 * 60 * 60
        });
        
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

  isAuthenticated(): boolean {
    return this.tokenManager.isTokenValid();
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.tokenManager.getToken();
  }

  getUser() {
    return gps51Client.getUser();
  }

  getClient() {
    return gps51Client;
  }

  logout(): void {
    this.tokenManager.clearToken();
    this.credentialsManager.clearCredentials();
    gps51Client.logout();
    console.log('GPS51AuthManager: Session logged out');
  }
}
