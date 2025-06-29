
import { useState, useCallback } from 'react';
import { RealTimeSyncStatus } from '@/services/gps51/types';

export const useGPS51SyncStatus = () => {
  const [status, setStatus] = useState<RealTimeSyncStatus>({
    isActive: false,
    isConnected: false,
    lastUpdate: null,
    activeDevices: 0,
    error: null
  });

  const updateStatus = useCallback((updates: Partial<RealTimeSyncStatus>) => {
    setStatus(prev => ({ ...prev, ...updates }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setStatus(prev => ({
      ...prev,
      error,
      isActive: false,
      isConnected: false
    }));
  }, []);

  const setSuccess = useCallback((activeDevices: number) => {
    setStatus(prev => ({
      ...prev,
      isActive: true,
      isConnected: true,
      lastUpdate: new Date(),
      activeDevices,
      error: null
    }));
  }, []);

  return {
    status,
    updateStatus,
    setError,
    setSuccess
  };
};
