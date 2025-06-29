
import { useState, useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { md5 } from 'js-md5';

export interface SessionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
  error: string | null;
  isConfigured: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  connectionHealth: 'good' | 'poor' | 'lost';
}

export const useGPS51SessionBridge = () => {
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: false,
    isAuthenticated: false,
    lastSync: null,
    error: null,
    isConfigured: false,
    syncStatus: 'idle',
    connectionHealth: 'lost'
  });

  const authService = GPS51AuthService.getInstance();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isConfigured = gps51ConfigService.isConfigured();
        const isAuthenticated = isConfigured && authService.isAuthenticated();
        const token = isAuthenticated ? await authService.getValidToken() : null;
        
        setStatus(prev => ({
          ...prev,
          isConnected: !!token,
          isAuthenticated,
          isConfigured,
          error: null,
          connectionHealth: token ? 'good' : 'lost'
        }));
      } catch (error) {
        console.error('GPS51 status check failed:', error);
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isConnected: false,
          isAuthenticated: false,
          connectionHealth: 'lost'
        }));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [authService]);

  const connect = async (credentials: { username: string; password: string; apiKey: string; apiUrl: string }) => {
    try {
      setStatus(prev => ({ ...prev, error: null, syncStatus: 'syncing' }));
      
      console.log('GPS51 Connection Debug - Starting authentication process...');
      console.log('Credentials provided:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        apiUrl: credentials.apiUrl,
        hasApiKey: !!credentials.apiKey
      });
      
      // Validate input credentials
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password are required');
      }
      
      if (!credentials.apiUrl) {
        throw new Error('API URL is required');
      }
      
      // Hash password with MD5 for GPS51 API (client-side hashing)
      console.log('Hashing password with MD5...');
      const hashedPassword = md5(credentials.password).toLowerCase();
      
      console.log('Password hashing details:', {
        originalLength: credentials.password.length,
        hashedLength: hashedPassword.length,
        isValidMD5Format: /^[a-f0-9]{32}$/.test(hashedPassword),
        firstChars: hashedPassword.substring(0, 8) + '...',
        lastChars: '...' + hashedPassword.substring(24)
      });
      
      const authCredentials = {
        ...credentials,
        password: hashedPassword
      };
      
      // Save configuration first
      console.log('Saving GPS51 configuration...');
      await gps51ConfigService.saveConfiguration(authCredentials);
      
      // Then authenticate
      console.log('Attempting GPS51 authentication...');
      const token = await authService.authenticate(authCredentials);
      
      if (!token || !token.access_token) {
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('GPS51 authentication successful:', {
        hasToken: !!token.access_token,
        tokenLength: token.access_token.length,
        tokenType: token.token_type,
        expiresIn: token.expires_in
      });
      
      setStatus(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        isConnected: true,
        isConfigured: true,
        lastSync: new Date(),
        syncStatus: 'success',
        connectionHealth: 'good',
        error: null
      }));
      
      return true;
    } catch (error) {
      console.error('GPS51 connection failed - detailed error:', {
        error: error.message,
        stack: error.stack,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          apiUrl: credentials.apiUrl,
          hasApiKey: !!credentials.apiKey
        }
      });
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      // Provide helpful guidance for common issues
      if (errorMessage.includes('8901')) {
        errorMessage += '\n\nTroubleshooting tips:\n• Verify your username and password are correct\n• Ensure you are using the correct API URL\n• Check that your account has proper permissions';
      }
      
      setStatus(prev => ({
        ...prev,
        error: errorMessage,
        isConnected: false,
        isAuthenticated: false,
        syncStatus: 'error',
        connectionHealth: 'lost'
      }));
      return false;
    }
  };

  const disconnect = () => {
    authService.logout();
    gps51ConfigService.clearConfiguration();
    setStatus({
      isConnected: false,
      isAuthenticated: false,
      isConfigured: false,
      lastSync: null,
      error: null,
      syncStatus: 'idle',
      connectionHealth: 'lost'
    });
  };

  const refresh = async () => {
    try {
      setStatus(prev => ({ ...prev, syncStatus: 'syncing', error: null }));
      console.log('Starting GPS51 data refresh...');
      
      const result = await gps51ConfigService.syncData();
      
      if (result.success) {
        console.log('GPS51 data refresh successful:', result);
        setStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          error: null,
          syncStatus: 'success',
          connectionHealth: 'good'
        }));
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      return result;
    } catch (error) {
      console.error('GPS51 refresh failed:', error);
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed',
        syncStatus: 'error',
        connectionHealth: 'poor'
      }));
      throw error;
    }
  };

  return {
    status,
    connect,
    disconnect,
    refresh
  };
};
