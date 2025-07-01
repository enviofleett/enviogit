
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { CredentialsValidator } from '@/components/settings/components/CredentialsValidator';

export class GPS51ConnectionService {
  private authService = GPS51AuthService.getInstance();

  async connect(credentials: {
    username: string;
    password: string;
    apiKey?: string;
    apiUrl: string;
    from?: string;
    type?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('=== GPS51 CONNECTION SERVICE CONNECT ===');
      console.log('1. Starting connection process...');
      
      // Validate credentials first
      const validation = CredentialsValidator.validateCredentials(credentials);
      if (!validation.isValid) {
        console.error('2. Credential validation failed:', validation.errors);
        return { 
          success: false, 
          error: `Credential validation failed: ${validation.errors.join(', ')}` 
        };
      }

      console.log('2. Credential validation passed');
      
      // Auto-migrate webapi to openapi endpoint
      let apiUrl = credentials.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51ConnectionService: Auto-migrating API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }
      
      // Hash password if needed
      const hashedPassword = CredentialsValidator.hashPassword(credentials.password);
      
      console.log('3. Processed credentials:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        passwordIsAlreadyHashed: CredentialsValidator.isValidMD5(credentials.password || ''),
        finalPasswordIsHashed: CredentialsValidator.isValidMD5(hashedPassword),
        apiUrl: apiUrl,
        originalApiUrl: credentials.apiUrl,
        migrated: apiUrl !== credentials.apiUrl,
        hasApiKey: !!credentials.apiKey,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      });
      
      // Prepare auth credentials with hashed password
      const authCredentials: GPS51Credentials = {
        username: credentials.username,
        password: hashedPassword, // Use hashed password
        apiKey: credentials.apiKey,
        apiUrl: apiUrl, // Use migrated URL
        from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
      };
      
      console.log('4. Prepared auth credentials:', {
        username: authCredentials.username,
        passwordIsValidMD5: CredentialsValidator.isValidMD5(authCredentials.password),
        passwordFirstChars: authCredentials.password.substring(0, 8) + '...',
        apiUrl: authCredentials.apiUrl,
        from: authCredentials.from,
        type: authCredentials.type,
        hasApiKey: !!authCredentials.apiKey,
        endpointMigrated: authCredentials.apiUrl.includes('/openapi')
      });
      
      // Save configuration first
      console.log('5. Saving configuration...');
      await gps51ConfigService.saveConfiguration(authCredentials);
      
      // Then authenticate
      console.log('6. Attempting authentication...');
      const token = await this.authService.authenticate(authCredentials);
      
      if (!token || !token.access_token) {
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('7. Authentication successful:', {
        hasToken: !!token.access_token,
        tokenLength: token.access_token.length,
        tokenType: token.token_type,
        expiresIn: token.expires_in
      });
      
      return { success: true };
    } catch (error) {
      console.error('GPS51 connection failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          passwordIsHashed: CredentialsValidator.isValidMD5(credentials.password || ''),
          apiUrl: credentials.apiUrl,
          hasApiKey: !!credentials.apiKey
        }
      });
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      // Provide helpful guidance for common issues
      if (errorMessage.includes('8901')) {
        errorMessage += '\n\nTroubleshooting tips:\n• Verify your username and password are correct\n• Ensure you are using the correct API URL\n• Check that your account has proper permissions';
      } else if (errorMessage.includes('Login failed')) {
        errorMessage += '\n\nPossible causes:\n• Incorrect username/password\n• Account locked or suspended\n• API endpoint not reachable\n• Invalid from/type parameters';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  disconnect(): void {
    this.authService.logout();
    gps51ConfigService.clearConfiguration();
    console.log('GPS51ConnectionService: Disconnected');
  }

  async refresh(): Promise<any> {
    console.log('Starting GPS51 data refresh...');
    
    const result = await gps51ConfigService.syncData();
    
    if (result.success) {
      console.log('GPS51 data refresh successful:', result);
      return result;
    } else {
      throw new Error(result.error || 'Sync failed');
    }
  }
}
