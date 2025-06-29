
import { useCallback } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { gps51Client } from '@/services/gps51/GPS51Client';

export const useGPS51Authentication = () => {
  const authService = GPS51AuthService.getInstance();

  const ensureAuthenticated = useCallback(async () => {
    console.log('🔐 Ensuring GPS51 authentication...');
    
    // Check if configured
    const isConfigured = await gps51ConfigService.isConfigured();
    if (!isConfigured) {
      throw new Error('GPS51 not configured. Please set up credentials in Settings.');
    }

    // Get credentials
    const credentials = await gps51ConfigService.getCredentials();
    console.log('✅ GPS51 credentials retrieved');

    // Check if already authenticated
    let isAuthenticated = authService.isAuthenticated();
    if (!isAuthenticated) {
      console.log('🔐 Authenticating with GPS51...');
      const authResult = await gps51Client.authenticate(credentials);
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error}`);
      }
      console.log('✅ GPS51 authentication successful');
    }

    // Get valid token
    const token = await authService.getValidToken();
    if (!token) {
      throw new Error('No valid GPS51 token available.');
    }

    return token;
  }, [authService]);

  return {
    ensureAuthenticated,
    isAuthenticated: authService.isAuthenticated()
  };
};
