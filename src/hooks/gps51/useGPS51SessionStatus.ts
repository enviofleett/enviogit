
import { useState, useCallback } from 'react';

export interface SessionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
  error: string | null;
  isConfigured: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  connectionHealth: 'good' | 'poor' | 'lost';
}

export const useGPS51SessionStatus = () => {
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: false,
    isAuthenticated: false,
    lastSync: null,
    error: null,
    isConfigured: false,
    syncStatus: 'idle',
    connectionHealth: 'lost'
  });

  const updateStatus = useCallback((updates: Partial<SessionStatus>) => {
    setStatus(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setStatus(prev => ({
      ...prev,
      error,
      isConnected: false,
      isAuthenticated: false,
      syncStatus: 'error',
      connectionHealth: 'lost'
    }));
  }, []);

  const setConnected = useCallback((activeDevices: number = 0) => {
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
  }, []);

  const setDisconnected = useCallback(() => {
    setStatus({
      isConnected: false,
      isAuthenticated: false,
      isConfigured: false,
      lastSync: null,
      error: null,
      syncStatus: 'idle',
      connectionHealth: 'lost'
    });
  }, []);

  const setSyncing = useCallback(() => {
    setStatus(prev => ({ ...prev, syncStatus: 'syncing', error: null }));
  }, []);

  return {
    status,
    updateStatus,
    setError,
    setConnected,
    setDisconnected,
    setSyncing
  };
};
