import { useState, useEffect, useCallback } from 'react';
import { gps51ProductionService, GPS51Vehicle, GPS51Position, LiveDataResult } from '@/services/gps51/GPS51ProductionService';
import { gps51UnifiedAuthManager } from '@/services/gps51/unified/GPS51UnifiedAuthManager';

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
  const [authRetryCount, setAuthRetryCount] = useState<number>(0);
  const [backoff, setBackoff] = useState<number>(1000);

  // Enhanced auto-authentication using unified manager
  const autoAuthenticate = useCallback(async (): Promise<boolean> => {
    try {
      console.log('GPS51UnifiedData: Auto-authenticating...');
      
      // Check if already authenticated with valid token
      const authState = gps51UnifiedAuthManager.getAuthState();
      if (authState.isAuthenticated && authState.token) {
        setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
        return true;
      }

      // Try to authenticate using stored credentials
      const storedCredentials = gps51UnifiedAuthManager.getStoredCredentials();
      if (!storedCredentials) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          error: 'GPS51 credentials not configured. Please go to Settings.' 
        }));
        return false;
      }

      console.log('GPS51UnifiedData: Authenticating with stored credentials:', {
        username: storedCredentials.username,
        hasPassword: !!storedCredentials.password
      });

      const result = await gps51UnifiedAuthManager.authenticate(
        storedCredentials.username, 
        storedCredentials.password,
        storedCredentials.apiUrl
      );
      
      if (result.success) {
        setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
        setAuthRetryCount(0);
        setBackoff(1000);
        
        console.log('GPS51UnifiedData: Auto-authentication successful');
        return true;
      } else {
        throw new Error(result.error || 'Authentication failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      console.error('GPS51UnifiedData: Auto-authentication failed:', error);
      
      setAuthRetryCount(prev => prev + 1);
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false, 
        error: errorMessage
      }));
      
      return false;
    }
  }, []);

  // Fetch live data using unified service
  const fetchLiveData = useCallback(async (deviceIds?: string[]): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Ensure authentication first
      const isAuth = await autoAuthenticate();
      if (!isAuth) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      console.log('GPS51UnifiedData: Fetching live data...');
      
      const liveData: LiveDataResult = await gps51ProductionService.getLiveData(deviceIds);

      if (liveData.isSuccess) {
        setState(prev => ({
          ...prev,
          devices: liveData.vehicles,
          positions: liveData.positions,
          lastUpdate: new Date(),
          isLoading: false,
          error: null
        }));

        setLastQueryTime(liveData.lastQueryTime);
        
        console.log('GPS51UnifiedData: Live data fetched successfully:', {
          vehicleCount: liveData.vehicles.length,
          positionCount: liveData.positions.length,
          lastQueryTime: liveData.lastQueryTime
        });
      } else {
        throw new Error(liveData.error || 'Failed to fetch live data');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      console.error('GPS51UnifiedData: Live data fetch failed:', error);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [autoAuthenticate]);

  // Start polling
  const startPolling = useCallback((deviceIds?: string[]) => {
    console.log('GPS51UnifiedData: Starting polling for device data...');
    
    // Clear existing timer
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // Initial fetch
    fetchLiveData(deviceIds);

    // Set up polling interval
    const timer = setInterval(() => {
      fetchLiveData(deviceIds);
    }, 30000); // 30 seconds

    setPollingTimer(timer);
    
    console.log('GPS51UnifiedData: Polling started with 30-second interval');
  }, [fetchLiveData, pollingTimer]);

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('GPS51UnifiedData: Stopping polling...');
    
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    
    setState(prev => ({ ...prev, pollingActive: false }));
  }, [pollingTimer]);

  // Manual refresh
  const refreshData = useCallback(async (): Promise<void> => {
    // Reset query time for full refresh
    gps51ProductionService.resetQueryTime();
    setLastQueryTime(0);
    
    await fetchLiveData();
  }, [fetchLiveData]);

  // Authenticate if needed
  const authenticateIfNeeded = useCallback(async (): Promise<boolean> => {
    return await autoAuthenticate();
  }, [autoAuthenticate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [pollingTimer]);

  // Initial authentication check
  useEffect(() => {
    autoAuthenticate();
  }, [autoAuthenticate]);

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