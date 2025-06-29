
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { GPS51CredentialValidator, GPS51ConnectionCredentials } from './GPS51CredentialValidator';

export class GPS51ConnectionManager {
  private authService = GPS51AuthService.getInstance();

  async connect(credentials: GPS51ConnectionCredentials): Promise<boolean> {
    try {
      console.log('=== GPS51 CONNECTION MANAGER CONNECT ===');
      console.log('1. Starting connection process...');
      
      // Validate credentials
      GPS51CredentialValidator.validateCredentials(credentials);
      
      // Prepare auth credentials
      const authCredentials = GPS51CredentialValidator.prepareAuthCredentials(credentials);
      
      console.log('2. Prepared auth credentials:', {
        username: authCredentials.username,
        passwordIsValidMD5: GPS51CredentialValidator.isValidMD5(authCredentials.password),
        passwordFirstChars: authCredentials.password.substring(0, 8) + '...',
        apiUrl: authCredentials.apiUrl,
        from: authCredentials.from,
        type: authCredentials.type,
        hasApiKey: !!authCredentials.apiKey,
        endpointMigrated: authCredentials.apiUrl.includes('/openapi')
      });
      
      // Save configuration first
      console.log('3. Saving configuration...');
      await gps51ConfigService.saveConfiguration(authCredentials);
      
      // Then authenticate
      console.log('4. Attempting authentication...');
      const token = await this.authService.authenticate(authCredentials);
      
      if (!token || !token.access_token) {
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('5. Authentication successful:', {
        hasToken: !!token.access_token,
        tokenLength: token.access_token.length,
        tokenType: token.token_type,
        expiresIn: token.expires_in
      });
      
      return true;
    } catch (error) {
      console.error('GPS51 connection failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          passwordIsHashed: GPS51CredentialValidator.isValidMD5(credentials.password || ''),
          apiUrl: credentials.apiUrl,
          hasApiKey: !!credentials.apiKey
        }
      });
      
      throw new Error(GPS51CredentialValidator.getErrorMessage(error));
    }
  }

  async disconnect(): Promise<void> {
    this.authService.logout();
    await gps51ConfigService.clearConfiguration();
  }

  async refresh(): Promise<any> {
    console.log('Starting GPS51 data refresh...');
    
    const result = await gps51ConfigService.syncData();
    
    if (!result.success) {
      throw new Error(result.error || 'Sync failed');
    }
    
    console.log('GPS51 data refresh successful:', result);
    return result;
  }

  async checkStatus(): Promise<{
    isConfigured: boolean;
    isAuthenticated: boolean;
    isConnected: boolean;
  }> {
    const isConfigured = await gps51ConfigService.isConfigured();
    const isAuthenticated = isConfigured && this.authService.isAuthenticated();
    const token = isAuthenticated ? await this.authService.getValidToken() : null;
    
    return {
      isConfigured,
      isAuthenticated,
      isConnected: !!token
    };
  }
}
