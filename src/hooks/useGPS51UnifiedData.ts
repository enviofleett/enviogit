import { useState, useEffect, useCallback } from 'react';
import { gps51CoordinatorClient } from '@/services/gps51/GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface GPS51UnifiedDataState {
  devices: GPS51Device[];
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

  // Optimized polling with proper incremental queries
  const pollData = useCallback(async (deviceIds?: string[]) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use incremental polling with lastQueryTime for efficiency
      const result = await gps51CoordinatorClient.getRealtimePositions(
        deviceIds || [],
        lastQueryTime
      );

      setState(prev => ({
        ...prev,
        positions: result.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      // Update lastQueryTime for next incremental query
      setLastQueryTime(result.lastQueryTime);

      console.log('GPS51UnifiedData: Incremental poll completed', {
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
      console.error('GPS51UnifiedData: Polling failed:', error);
    }
  }, [lastQueryTime]);

  const startPolling = useCallback((deviceIds?: string[]) => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // Start with immediate poll (lastQueryTime=0 for initial data)
    setLastQueryTime(0);
    pollData(deviceIds);

    // Set up optimized polling interval (30-60 seconds as recommended)
    const timer = setInterval(() => {
      pollData(deviceIds);
    }, 30000); // 30 seconds - single coordinated interval

    setPollingTimer(timer);
    console.log('GPS51UnifiedData: Started optimized polling with 30s interval');
  }, [pollData, pollingTimer]);

  const stopPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    setState(prev => ({ ...prev, pollingActive: false }));
    console.log('GPS51UnifiedData: Stopped polling');
  }, [pollingTimer]);

  const refreshData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch devices and positions
      const [devices, positionsResult] = await Promise.all([
        gps51CoordinatorClient.getDeviceList(),
        gps51CoordinatorClient.getRealtimePositions([], 0) // Get all current data
      ]);

      setState(prev => ({
        ...prev,
        devices,
        positions: positionsResult.positions,
        lastUpdate: new Date(),
        isLoading: false
      }));

      setLastQueryTime(positionsResult.lastQueryTime);

      console.log('GPS51UnifiedData: Manual refresh completed', {
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
      console.error('GPS51UnifiedData: Refresh failed:', error);
    }
  }, []);

  const authenticateIfNeeded = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check coordinator status
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