import { useState, useEffect, useCallback } from 'react';
import { gps51ProductionService, GPS51Vehicle, GPS51Position } from '@/services/gps51/GPS51ProductionService';
import { GPS51Device } from '@/services/gps51/types';

export interface GPS51UnifiedDataState {
  devices: GPS51Vehicle[];
  positions: GPS51Position[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isAuthenticated: boolean;
  pollingActive: boolean;
}

export interface GPS51UnifiedDataActions {
  startPolling: (deviceIds?: string[]) => void;
  stopPolling: () => void;
  refreshData: () => Promise<void>;
  authenticateIfNeeded: () => Promise<boolean>;
}

export interface UseGPS51UnifiedDataReturn {
  state: GPS51UnifiedDataState;
  actions: GPS51UnifiedDataActions;
}

export const useGPS51UnifiedData = (): UseGPS51UnifiedDataReturn => {
  const [state, setState] = useState<GPS51UnifiedDataState>({
    devices: [],
    positions: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
    isAuthenticated: false,
    pollingActive: false
  });

  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastQueryTime, setLastQueryTime] = useState<number>(0);

  // Simple polling with lastquerypositiontime incremental updates
  const pollData = useCallback(async (deviceIds?: string[]) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use unified service instead of coordinator client
      const result = await gps51ProductionService.fetchLivePositions(deviceIds);

      setState(prev => ({
        ...prev,
        positions: result.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      // Update lastQueryTime from server response for incremental polling
      setLastQueryTime(result.lastQueryTime);

      console.log('GPS51Data: Poll completed', {
        positionsReceived: result.positions.length,
        lastQueryTime: result.lastQueryTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Polling failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      console.error('GPS51Data: Polling failed:', error);
    }
  }, [lastQueryTime]);

  const startPolling = useCallback((deviceIds?: string[]) => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // Initial poll with lastQueryTime=0 per API documentation
    setLastQueryTime(0);
    pollData(deviceIds);

    // ENHANCED: Adaptive polling interval based on system load and activity
    const timer = setInterval(() => {
      pollData(deviceIds);
    }, 45000); // FIXED: 45 seconds minimum interval (was 60s, suitable middle ground)

    setPollingTimer(timer);
    console.log('GPS51Data: Started polling with 60s fixed interval');
  }, [pollData, pollingTimer]);

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

      // Fetch devices and positions using unified service
      const devices = await gps51ProductionService.fetchUserDevices();
      const positionsResult = await gps51ProductionService.fetchLivePositions();

      setState(prev => ({
        ...prev,
        devices,
        positions: positionsResult.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      setLastQueryTime(positionsResult.lastQueryTime);

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

      // Check unified service authentication status
      const authState = gps51ProductionService.getAuthState();
      
      setState(prev => ({
        ...prev,
        isAuthenticated: authState.isAuthenticated,
        isLoading: false
      }));

      return authState.isAuthenticated;
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

  // Initialize authentication status
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