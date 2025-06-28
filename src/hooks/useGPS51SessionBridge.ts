
import { useState, useEffect } from 'react';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { GPS51SessionManager } from '@/services/gp51/GPS51SessionManager';

export interface SessionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
  error: string | null;
}

export const useGPS51SessionBridge = () => {
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: false,
    isAuthenticated: false,
    lastSync: null,
    error: null
  });

  const authService = GPS51AuthService.getInstance();
  const sessionManager = GPS51SessionManager.getInstance();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isAuthenticated = authService.isAuthenticated();
        const isConnected = await sessionManager.isConnected();
        
        setStatus({
          isConnected,
          isAuthenticated,
          lastSync: sessionManager.getLastSyncTime(),
          error: null
        });
      } catch (error) {
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [authService, sessionManager]);

  const connect = async (credentials: { username: string; password: string; apiKey: string }) => {
    try {
      setStatus(prev => ({ ...prev, error: null }));
      
      const token = await authService.authenticate(credentials);
      await sessionManager.initialize(token.access_token);
      
      setStatus(prev => ({ 
        ...prev, 
        isAuthenticated: true, 
        isConnected: true,
        lastSync: new Date()
      }));
      
      return true;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
      return false;
    }
  };

  const disconnect = () => {
    authService.logout();
    sessionManager.cleanup();
    setStatus({
      isConnected: false,
      isAuthenticated: false,
      lastSync: null,
      error: null
    });
  };

  return {
    status,
    connect,
    disconnect,
    refresh: () => sessionManager.syncData()
  };
};
