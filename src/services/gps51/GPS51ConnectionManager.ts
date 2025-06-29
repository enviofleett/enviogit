
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { GPS51CredentialValidator, GPS51ConnectionCredentials } from './GPS51CredentialValidator';
import { supabase } from '@/integrations/supabase/client';

export class GPS51ConnectionManager {
  private authService = GPS51AuthService.getInstance();

  async connect(credentials: GPS51ConnectionCredentials): Promise<boolean> {
    try {
      console.log('=== GPS51 CONNECTION MANAGER CONNECT ===');
      console.log('1. Starting connection process...');
      
      GPS51CredentialValidator.validateCredentials(credentials);
      
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
      
      console.log('3. Saving configuration...');
      const saveResult = await gps51ConfigService.saveConfiguration(authCredentials);
      if (!saveResult) {
        throw new Error('Failed to save configuration');
      }
      
      console.log('4. Attempting authentication...');
      const authResult = await this.authService.authenticate(authCredentials);
      
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error || 'Unknown error'}`);
      }

      console.log('5. Authentication successful');
      
      // Test the connection by calling the sync function
      console.log('6. Testing sync with credentials...');
      try {
        const { data, error } = await supabase.functions.invoke('gps51-sync', {
          body: {
            username: authCredentials.username,
            password: authCredentials.password,
            apiUrl: authCredentials.apiUrl,
            priority: 1
          }
        });

        if (error) {
          console.warn('Sync test failed but authentication succeeded:', error);
        } else {
          console.log('7. Sync test successful:', data);
        }
      } catch (syncError) {
        console.warn('Sync test failed but authentication succeeded:', syncError);
      }
      
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
    
    try {
      // Get current credentials
      const config = await gps51ConfigService.getConfig();
      if (!config) {
        throw new Error('No GPS51 configuration found');
      }

      // Call the sync function with current credentials
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          username: config.username,
          password: config.password,
          apiUrl: config.apiUrl,
          priority: 2
        }
      });

      if (error) {
        throw new Error(error.message || 'Sync failed');
      }

      console.log('GPS51 data refresh successful:', data);
      return data;
    } catch (error) {
      console.error('GPS51 refresh error:', error);
      throw error;
    }
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
