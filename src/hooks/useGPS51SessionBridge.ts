
import { useState, useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';

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

  const isValidMD5 = (str: string): boolean => {
    return /^[a-f0-9]{32}$/.test(str);
  };

  const connect = async (credentials: { username: string; password: string; apiKey?: string; apiUrl: string; from?: string; type?: string }) => {
    try {
      setStatus(prev => ({ ...prev, error: null, syncStatus: 'syncing' }));
      
      console.log('=== GPS51 SESSION BRIDGE CONNECT ===');
      console.log('1. Starting connection process...');
      console.log('2. Received credentials:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        passwordIsAlreadyHashed: isValidMD5(credentials.password || ''),
        apiUrl: credentials.apiUrl,
        hasApiKey: !!credentials.apiKey,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      });
      
      // Validate input credentials
      if (!credentials.username || !credentials.password) {
        throw new Error('Username and password are required');
      }
      
      if (!credentials.apiUrl) {
        throw new Error('API URL is required');
      }
      
      // DON'T hash password here - it should already be hashed from the form
      const authCredentials = {
        username: credentials.username,
        password: credentials.password, // Use as-is, should already be MD5 hashed
        apiKey: credentials.apiKey,
        apiUrl: credentials.apiUrl,
        from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
      };
      
      console.log('3. Prepared auth credentials:', {
        username: authCredentials.username,
        passwordIsValidMD5: isValidMD5(authCredentials.password),
        passwordFirstChars: authCredentials.password.substring(0, 8) + '...',
        apiUrl: authCredentials.apiUrl,
        from: authCredentials.from,
        type: authCredentials.type,
        hasApiKey: !!authCredentials.apiKey
      });
      
      // Save configuration first
      console.log('4. Saving configuration...');
      await gps51ConfigService.saveConfiguration(authCredentials);
      
      // Then authenticate
      console.log('5. Attempting authentication...');
      const token = await authService.authenticate(authCredentials);
      
      if (!token || !token.access_token) {
        throw new Error('Authentication failed - no token received');
      }
      
      console.log('6. Authentication successful:', {
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
      console.error('GPS51 connection failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          passwordIsHashed: isValidMD5(credentials.password || ''),
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
