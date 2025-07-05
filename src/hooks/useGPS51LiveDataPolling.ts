import { useCallback, useRef } from 'react';

interface LiveDataOptions {
  enabled?: boolean;
  pollingInterval?: number;
  maxRetries?: number;
  autoStart?: boolean;
}

interface LiveDataState {
  devices: any[];
  positions: any[];
  lastUpdate: Date | null;
}

export const useGPS51LiveDataPolling = (
  options: LiveDataOptions,
  updateLiveData: (data: LiveDataState) => void,
  setErrorState: (error: string | null) => void,
  setLoadingState: (loading: boolean) => void
) => {
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isPolling = useRef(false);

  // Mock service for now - this would connect to actual GPS51 service
  const service = {
    getDeviceById: (deviceId: string) => null,
    getPositionByDeviceId: (deviceId: string) => null
  };

  const refresh = useCallback(async () => {
    try {
      setLoadingState(true);
      
      // Mock data for now - this would fetch from actual GPS51 API
      const mockData: LiveDataState = {
        devices: [],
        positions: [],
        lastUpdate: new Date()
      };
      
      updateLiveData(mockData);
      setErrorState(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      setErrorState(errorMessage);
    } finally {
      setLoadingState(false);
    }
  }, [updateLiveData, setErrorState, setLoadingState]);

  const startPolling = useCallback(() => {
    if (isPolling.current) return;
    
    isPolling.current = true;
    const interval = options.pollingInterval || 30000;
    
    pollingInterval.current = setInterval(() => {
      refresh();
    }, interval);
    
    // Initial fetch
    refresh();
  }, [refresh, options.pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    isPolling.current = false;
  }, []);

  return {
    refresh,
    startPolling,
    stopPolling,
    service
  };
};