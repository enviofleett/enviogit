
import { useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51ConnectionManager } from '@/services/gps51/GPS51ConnectionManager';
import { GPS51CredentialValidator, GPS51ConnectionCredentials } from '@/services/gps51/GPS51CredentialValidator';
import { useGPS51SessionStatus, SessionStatus } from './gps51/useGPS51SessionStatus';

export const useGPS51SessionBridge = () => {
  const { 
    status, 
    setError, 
    setConnected, 
    setDisconnected, 
    setSyncing, 
    updateStatus 
  } = useGPS51SessionStatus();
  
  const connectionManager = new GPS51ConnectionManager();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const statusCheck = await connectionManager.checkStatus();
        
        updateStatus({
          isConnected: statusCheck.isConnected,
          isAuthenticated: statusCheck.isAuthenticated,
          isConfigured: statusCheck.isConfigured,
          error: null,
          connectionHealth: statusCheck.isConnected ? 'good' : 'lost'
        });
      } catch (error) {
        console.error('GPS51 status check failed:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const connect = async (credentials: GPS51ConnectionCredentials) => {
    try {
      setError(null);
      setSyncing();
      
      const success = await connectionManager.connect(credentials);
      
      if (success) {
        setConnected();
      }
      
      return success;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection failed');
      return false;
    }
  };

  const disconnect = async () => {
    await connectionManager.disconnect();
    setDisconnected();
  };

  const refresh = async () => {
    try {
      setSyncing();
      const result = await connectionManager.refresh();
      
      updateStatus({
        lastSync: new Date(),
        error: null,
        syncStatus: 'success',
        connectionHealth: 'good'
      });
      
      return result;
    } catch (error) {
      console.error('GPS51 refresh failed:', error);
      setError(error instanceof Error ? error.message : 'Sync failed');
      throw error;
    }
  };

  // Initialize configuration on mount
  useEffect(() => {
    gps51ConfigService.initializeFromAuth();
  }, []);

  return {
    status,
    connect,
    disconnect,
    refresh
  };
};

export type { SessionStatus };
