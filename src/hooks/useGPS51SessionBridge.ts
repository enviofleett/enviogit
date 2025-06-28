
import { useState, useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService'; // Fixed: consistent casing

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
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [authService]);

  const connect = async (credentials: { username: string; password: string; apiKey: string; apiUrl: string }) => {
    try {
      setStatus(prev => ({ ...prev, error: null, syncStatus: 'syncing' }));
      
      // Hash password with MD5 for GPS51 API
      const { md5 } = await import('js-md5');
      const hashedPassword = md5(credentials.password).toLowerCase();
      
      // Save configuration first
      await gps51ConfigService.saveConfiguration({
        ...credentials,
        password: hashedPassword
      });
      
      // Then authenticate
      const token = await authService.authenticate({
        ...credentials,
        password: hashedPassword
      });
      
      setStatus(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        isConnected: true,
        isConfigured: true,
        lastSync: new Date(),
        syncStatus: 'success',
        connectionHealth: 'good'
      }));
      
      return true;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
        isAuthenticated: false,
        syncStatus: 'error',
        connectionHealth: 'lost'
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
      error: null,
      syncStatus: 'idle',
      connectionHealth: 'lost'
    });
  };

  const refresh = async () => {
    try {
      setStatus(prev => ({ ...prev, syncStatus: 'syncing' }));
      const result = await gps51ConfigService.syncData();
      if (result.success) {
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
