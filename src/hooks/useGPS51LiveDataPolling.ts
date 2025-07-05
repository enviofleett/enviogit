
import { useEffect, useCallback, useRef } from 'react';
import { GPS51LiveDataService, LiveDataState, gps51LiveDataService } from '@/services/gps51/GPS51LiveDataService';

export interface LiveDataPollingOptions {
  enabled?: boolean;
  pollingInterval?: number;
  autoStart?: boolean;
}

export const useGPS51LiveDataPolling = (
  options: LiveDataPollingOptions,
  onDataUpdate: (data: LiveDataState) => void,
  onError: (error: string) => void,
  setLoading: (loading: boolean) => void
) => {
  const {
    enabled = true,
    pollingInterval = 30000,
    autoStart = true
  } = options;

  const serviceRef = useRef<GPS51LiveDataService>(gps51LiveDataService);

  // Handle live data updates
  const handleLiveDataUpdate = useCallback((data: LiveDataState) => {
    onDataUpdate(data);
  }, [onDataUpdate]);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      onError(null);
      
      const data = await serviceRef.current.fetchLiveData();
      handleLiveDataUpdate(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      onError(errorMessage);
      console.error('useGPS51LiveDataPolling: Manual refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, handleLiveDataUpdate, onError, setLoading]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (!enabled) return;
    
    serviceRef.current.updatePollingInterval(pollingInterval);
    serviceRef.current.startPolling(handleLiveDataUpdate);
  }, [enabled, pollingInterval, handleLiveDataUpdate]);

  const stopPolling = useCallback(() => {
    serviceRef.current.stopPolling();
  }, []);

  // Effect for managing polling lifecycle
  useEffect(() => {
    if (enabled && autoStart) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, autoStart, startPolling, stopPolling]);

  return {
    refresh,
    startPolling,
    stopPolling,
    service: serviceRef.current
  };
};
