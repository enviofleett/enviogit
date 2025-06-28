
import { useState, useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';

export interface SessionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
  error: string | null;
  isConfigured: boolean;
}

export const useGPS51SessionBridge = () => {
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: false,
    isAuthenticated: false,
    lastSync: null,
    error: null,
    isConfigured: false
  });

  const authService = GPS51AuthService.getInstance();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isConfigured = gps51ConfigService.isConfigured();
        const isAuthenticated = isConfigured && authService.isAuthenticated();
        const token = isAuthenticated ? await authService.getValidToken() : null;
        
        setStatus({
          isConnected: !!token,
          isAuthenticated,
          isConfigured,
          lastSync: null, // We'll track this when sync operations occur
          error: null
        });
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isConnected: false,
          isAuthenticated: false
        }));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [authService]);

  const connect = async (credentials: { username: string; password: string; apiKey: string; apiUrl: string }) => {
    try {
      setStatus(prev => ({ ...prev, error: null }));
      
      // Save configuration first
      await gps51ConfigService.saveConfiguration(credentials);
      
      // Then authenticate
      const token = await authService.authenticate(credentials);
      
      setStatus(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        isConnected: true,
        isConfigured: true,
        lastSync: new Date()
      }));
      
      return true;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
        isAuthenticated: false
      }));
      return false;
    }
  };

  const disconnect = () => {
    gps51ConfigService.clearConfiguration();
    setStatus({
      isConnected: false,
      isAuthenticated: false,
      isConfigured: false,
      lastSync: null,
      error: null
    });
  };

  const refresh = async () => {
    try {
      const result = await gps51ConfigService.syncData();
      if (result.success) {
        setStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          error: null
        }));
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      return result;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Sync failed'
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
