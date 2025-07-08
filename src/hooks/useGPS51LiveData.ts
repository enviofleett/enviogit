/**
 * Primary GPS51 Live Data Hook
 * Implements the complete GPS51 API flow with smart polling
 * Replaces all other GPS51 hooks for unified data management
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51UnifiedLiveDataService, GPS51Vehicle, GPS51Position, LiveDataResult, GPS51AuthState } from '@/services/gps51/GPS51UnifiedLiveDataService';

export interface UseGPS51LiveDataOptions {
  autoStart?: boolean;
  username?: string;
  password?: string;
  deviceIds?: string[];
  enableSmartPolling?: boolean;
}

export interface GPS51LiveDataState {
  vehicles: GPS51Vehicle[];
  positions: GPS51Position[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  authState: GPS51AuthState;
  lastUpdate: Date | null;
  pollingInterval: number;
  retryCount: number;
}

export interface GPS51LiveDataActions {
  authenticate: (username: string, password: string) => Promise<boolean>;
  startPolling: (deviceIds?: string[]) => void;
  stopPolling: () => void;
  refreshData: () => Promise<void>;
  logout: () => Promise<void>;
  clearCaches: () => void;
  resetQueryTime: () => void;
}

export interface UseGPS51LiveDataReturn {
  state: GPS51LiveDataState;
  actions: GPS51LiveDataActions;
  serviceStatus: any;
}

export const useGPS51LiveData = (options: UseGPS51LiveDataOptions = {}): UseGPS51LiveDataReturn => {
  const {
    autoStart = false,
    username,
    password,
    deviceIds,
    enableSmartPolling = true
  } = options;

  const [state, setState] = useState<GPS51LiveDataState>({
    vehicles: [],
    positions: [],
    isLoading: false,
    isPolling: false,
    error: null,
    authState: gps51UnifiedLiveDataService.getAuthState(),
    lastUpdate: null,
    pollingInterval: 10000,
    retryCount: 0
  });

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  /**
   * Authentication function
   */
  const authenticate = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const authState = await gps51UnifiedLiveDataService.authenticate(username, password);
      
      // Fetch user devices after successful authentication
      await gps51UnifiedLiveDataService.fetchUserDevices();
      
      setState(prev => ({
        ...prev,
        authState,
        isLoading: false,
        vehicles: gps51UnifiedLiveDataService.getDevices()
      }));

      console.log('useGPS51LiveData: Authentication and device fetch completed');
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        authState: gps51UnifiedLiveDataService.getAuthState()
      }));
      
      console.error('useGPS51LiveData: Authentication failed:', error);
      return false;
    }
  }, []);

  /**
   * Polling function with smart intervals and retry logic
   */
  const pollData = useCallback(async (targetDeviceIds?: string[]) => {
    if (!isPollingRef.current) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result: LiveDataResult = await gps51UnifiedLiveDataService.fetchLivePositions(targetDeviceIds);

      if (result.isSuccess) {
        const newInterval = enableSmartPolling 
          ? gps51UnifiedLiveDataService.calculatePollingInterval()
          : 10000; // Default 10 seconds

        setState(prev => ({
          ...prev,
          vehicles: result.vehicles,
          positions: result.positions,
          lastUpdate: new Date(),
          isLoading: false,
          pollingInterval: newInterval,
          retryCount: 0
        }));

        console.log('useGPS51LiveData: Poll completed successfully', {
          vehicleCount: result.vehicles.length,
          positionCount: result.positions.length,
          isEmpty: result.isEmpty,
          nextInterval: newInterval
        });

        // Schedule next poll with calculated interval
        if (isPollingRef.current) {
          pollingTimerRef.current = setTimeout(() => {
            pollData(targetDeviceIds);
          }, newInterval);
        }

      } else {
        // Handle polling error with exponential backoff
        const retryDelay = gps51UnifiedLiveDataService.calculateRetryDelay();
        const shouldRetry = gps51UnifiedLiveDataService.shouldRetry();

        setState(prev => ({
          ...prev,
          error: result.error || 'Polling failed',
          isLoading: false,
          retryCount: prev.retryCount + 1
        }));

        if (shouldRetry && isPollingRef.current) {
          console.log('useGPS51LiveData: Retrying poll after', retryDelay, 'ms');
          pollingTimerRef.current = setTimeout(() => {
            pollData(targetDeviceIds);
          }, retryDelay);
        } else {
          console.error('useGPS51LiveData: Maximum retries reached, stopping polling');
          stopPolling();
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Polling failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        retryCount: prev.retryCount + 1
      }));

      // Stop polling on critical errors
      if (errorMessage.includes('Not authenticated')) {
        console.error('useGPS51LiveData: Authentication error, stopping polling');
        stopPolling();
      }
    }
  }, [enableSmartPolling]);

  /**
   * Start polling with smart intervals
   */
  const startPolling = useCallback((targetDeviceIds?: string[]) => {
    if (!state.authState.isAuthenticated) {
      console.error('useGPS51LiveData: Cannot start polling - not authenticated');
      return;
    }

    if (isPollingRef.current) {
      stopPolling(); // Stop existing polling
    }

    isPollingRef.current = true;
    setState(prev => ({ ...prev, isPolling: true, retryCount: 0 }));

    // Reset query time for fresh start
    gps51UnifiedLiveDataService.resetQueryTime();

    console.log('useGPS51LiveData: Starting smart polling for', targetDeviceIds || 'all devices');
    
    // Start immediate poll
    pollData(targetDeviceIds);
  }, [state.authState.isAuthenticated, pollData]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    setState(prev => ({ ...prev, isPolling: false }));
    console.log('useGPS51LiveData: Polling stopped');
  }, []);

  /**
   * Manual data refresh
   */
  const refreshData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Reset query time for full refresh
      gps51UnifiedLiveDataService.resetQueryTime();
      
      const result = await gps51UnifiedLiveDataService.fetchLivePositions(deviceIds);

      setState(prev => ({
        ...prev,
        vehicles: result.vehicles,
        positions: result.positions,
        lastUpdate: new Date(),
        isLoading: false,
        error: result.isSuccess ? null : result.error || 'Refresh failed'
      }));

      console.log('useGPS51LiveData: Manual refresh completed');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
    }
  }, [deviceIds]);

  /**
   * Logout and clear data
   */
  const logout = useCallback(async () => {
    stopPolling();
    
    try {
      await gps51UnifiedLiveDataService.logout();
      
      setState({
        vehicles: [],
        positions: [],
        isLoading: false,
        isPolling: false,
        error: null,
        authState: gps51UnifiedLiveDataService.getAuthState(),
        lastUpdate: null,
        pollingInterval: 10000,
        retryCount: 0
      });

      console.log('useGPS51LiveData: Logout completed');

    } catch (error) {
      console.error('useGPS51LiveData: Logout error:', error);
    }
  }, [stopPolling]);

  /**
   * Clear all caches
   */
  const clearCaches = useCallback(() => {
    gps51UnifiedLiveDataService.clearCaches();
    console.log('useGPS51LiveData: Caches cleared');
  }, []);

  /**
   * Reset query time
   */
  const resetQueryTime = useCallback(() => {
    gps51UnifiedLiveDataService.resetQueryTime();
    console.log('useGPS51LiveData: Query time reset');
  }, []);

  /**
   * Auto-start authentication and polling if credentials provided
   */
  useEffect(() => {
    if (autoStart && username && password) {
      console.log('useGPS51LiveData: Auto-starting with provided credentials');
      
      authenticate(username, password).then(success => {
        if (success) {
          startPolling(deviceIds);
        }
      });
    }
  }, [autoStart, username, password, deviceIds, authenticate, startPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  /**
   * Get current service status for debugging
   */
  const serviceStatus = gps51UnifiedLiveDataService.getServiceStatus();

  return {
    state,
    actions: {
      authenticate,
      startPolling,
      stopPolling,
      refreshData,
      logout,
      clearCaches,
      resetQueryTime
    },
    serviceStatus
  };
};