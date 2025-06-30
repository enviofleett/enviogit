
import { gps51Client, GPS51AuthCredentials } from './GPS51Client';
import { GPS51TokenManager, GPS51AuthToken } from '../gp51/GPS51TokenManager';
import { GPS51CredentialsManager, GPS51Credentials } from '../gp51/GPS51CredentialsManager';

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

      // Ensure tokens are synchronized between client and manager
      const clientToken = gps51Client.getToken();
      if (!clientToken) {
        throw new Error('Authentication succeeded but no token received');
      }

      const token = this.tokenManager.setToken({
        access_token: clientToken,
        expires_in: 24 * 60 * 60 // 24 hours
      });

      // Store credentials for future refresh attempts
      this.credentialsManager.setCredentials(credentials);
      
      console.log('GPS51AuthManager: Authentication successful, token synchronized');
      return token;

    } catch (error) {
      console.error('GPS51AuthManager: Authentication failed:', error);
      this.logout();
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getValidToken(): Promise<string | null> {
    const token = await this.tokenManager.getValidToken();
    
    // Ensure client token is synchronized
    if (token && gps51Client.getToken() !== token) {
      console.log('GPS51AuthManager: Synchronizing token with client');
      // Note: We can't directly set the client token, but we can verify it's valid
      const isClientAuthenticated = gps51Client.isAuthenticated();
      if (!isClientAuthenticated) {
        console.warn('GPS51AuthManager: Client token out of sync, attempting refresh');
        return null;
      }
    }
    
    return token;
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    try {
      console.log('GPS51AuthManager: Attempting token refresh...');
      
      // First, try to refresh using the GPS51 client
      const refreshSuccess = await gps51Client.refreshToken();
      if (refreshSuccess) {
        // Token is still valid, update expiry and synchronize
        const clientToken = gps51Client.getToken();
        if (clientToken) {
          const token = this.tokenManager.setToken({
            access_token: clientToken,
            expires_in: 24 * 60 * 60
          });
          
          console.log('GPS51AuthManager: Token refreshed successfully');
          return token;
        }
      }

      // If refresh failed, try full re-authentication with stored credentials
      console.log('GPS51AuthManager: Token refresh failed, attempting re-authentication...');
      const credentials = this.credentialsManager.getCredentials();
      
      if (credentials && credentials.password) {
        console.log('GPS51AuthManager: Re-authenticating with stored credentials');
        return await this.authenticate(credentials);
      } else {
        console.warn('GPS51AuthManager: No stored credentials available for re-authentication');
        return null;
      }
    } catch (error) {
      console.error('GPS51AuthManager: Token refresh failed:', error);
      return null;
    }
  }

  async restoreAuthentication(): Promise<boolean> {
    try {
      console.log('GPS51AuthManager: Attempting to restore authentication...');
      
      // Check if we have stored credentials
      if (!this.credentialsManager.hasStoredCredentials()) {
        console.log('GPS51AuthManager: No stored credentials found');
        return false;
      }

      // Try to restore with stored credentials
      const credentials = this.credentialsManager.getCredentials();
      if (credentials && credentials.password) {
        console.log('GPS51AuthManager: Restoring authentication with stored credentials');
        const token = await this.authenticate(credentials);
        return !!token;
      }

      return false;
    } catch (error) {
      console.error('GPS51AuthManager: Failed to restore authentication:', error);
      return false;
    }
  }

  isAuthenticated(): boolean {
    const tokenValid = this.tokenManager.isTokenValid();
    const clientAuthenticated = gps51Client.isAuthenticated();
    
    // Both should be synchronized
    if (tokenValid !== clientAuthenticated) {
      console.warn('GPS51AuthManager: Token manager and client authentication state out of sync');
    }
    
    return tokenValid && clientAuthenticated;
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
