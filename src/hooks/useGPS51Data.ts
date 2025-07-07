import { useState, useEffect, useCallback } from 'react';
import { gps51CoordinatorClient } from '@/services/gps51/GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface GPS51DataState {
  devices: GPS51Device[];
  positions: GPS51Position[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isAuthenticated: boolean;
  pollingActive: boolean;
}

export interface GPS51DataActions {
  startPolling: () => void;
  stopPolling: () => void;
  refreshData: () => Promise<void>;
  authenticateIfNeeded: () => Promise<boolean>;
}

export interface UseGPS51DataReturn {
  state: GPS51DataState;
  actions: GPS51DataActions;
}

/**
 * Simple GPS51 data hook following pure API documentation pattern
 * - Single action=lastposition API call
 * - Uses lastquerypositiontime for incremental updates
 * - Fixed 60-second polling interval
 * - No adaptive logic, no orchestration, no user activity tracking
 */
export const useGPS51Data = (): UseGPS51DataReturn => {
  const [state, setState] = useState<GPS51DataState>({
    devices: [],
    positions: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
    isAuthenticated: false,
    pollingActive: false
  });

  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastQueryPositionTime, setLastQueryPositionTime] = useState<number>(0);

  // Simple API call: action=lastposition with lastquerypositiontime
  const fetchPositions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Direct lastposition API call as per documentation
      const result = await gps51CoordinatorClient.getRealtimePositions([], lastQueryPositionTime);

      setState(prev => ({
        ...prev,
        positions: result.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      // Update lastQueryPositionTime from server response for next incremental call
      setLastQueryPositionTime(result.lastQueryTime);

      console.log('GPS51Data: Fetched positions', {
        count: result.positions.length,
        lastQueryTime: result.lastQueryTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      console.error('GPS51Data: Fetch failed:', error);
    }
  }, [lastQueryPositionTime]);

  const startPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // Initial call with lastQueryPositionTime=0 for first fetch
    setLastQueryPositionTime(0);
    fetchPositions();

    // Fixed 60-second interval as recommended in API documentation
    const timer = setInterval(fetchPositions, 60000);
    setPollingTimer(timer);
    
    console.log('GPS51Data: Started polling (60s interval)');
  }, [fetchPositions, pollingTimer]);

  const stopPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    setState(prev => ({ ...prev, pollingActive: false }));
    console.log('GPS51Data: Stopped polling');
  }, [pollingTimer]);

  const refreshData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch devices first
      const devices = await gps51CoordinatorClient.getDeviceList();
      
      // Then fetch all positions (reset lastQueryPositionTime for full refresh)
      const positionsResult = await gps51CoordinatorClient.getRealtimePositions([], 0);

      setState(prev => ({
        ...prev,
        devices,
        positions: positionsResult.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      setLastQueryPositionTime(positionsResult.lastQueryTime);

      console.log('GPS51Data: Manual refresh completed', {
        devices: devices.length,
        positions: positionsResult.positions.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      console.error('GPS51Data: Refresh failed:', error);
    }
  }, []);

  const authenticateIfNeeded = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const status = await gps51CoordinatorClient.getCoordinatorStatus();
      
      setState(prev => ({
        ...prev,
        isAuthenticated: !status.circuitBreakerOpen,
        isLoading: false
      }));

      return !status.circuitBreakerOpen;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        error: 'Authentication check failed',
        isLoading: false
      }));
      return false;
    }
  }, []);

  // Initialize authentication
  useEffect(() => {
    authenticateIfNeeded();
  }, [authenticateIfNeeded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [pollingTimer]);

  return {
    state,
    actions: {
      startPolling,
      stopPolling,
      refreshData,
      authenticateIfNeeded
    }
  };
};