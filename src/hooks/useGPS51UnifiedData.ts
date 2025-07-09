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
  const [authRetryCount, setAuthRetryCount] = useState<number>(0);
  const [backoff, setBackoff] = useState<number>(1000);

  // FIXED: Enhanced auto-authentication with token validation
  const autoAuthenticate = useCallback(async (): Promise<boolean> => {
    try {
      console.log('GPS51UnifiedData: Auto-authenticating...');
      
      // Check if already authenticated with valid token
      const authState = gps51ProductionService.getAuthState();
      if (authState.isAuthenticated && authState.token) {
        setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
        return true;
      }

      // Try to authenticate using stored credentials
      const credentials = {
        username: localStorage.getItem('gps51_username') || '',
        password: localStorage.getItem('gps51_password') || ''
      };

      if (!credentials.username || !credentials.password) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false, 
          error: 'GPS51 credentials not configured. Please go to Settings.' 
        }));
        return false;
      }

      console.log('GPS51UnifiedData: Authenticating with stored credentials:', {
        username: credentials.username,
        hasPassword: !!credentials.password
      });

      await gps51ProductionService.authenticate(credentials.username, credentials.password);
      
      // Verify authentication was successful
      const newAuthState = gps51ProductionService.getAuthState();
      if (newAuthState.isAuthenticated && newAuthState.token) {
        setState(prev => ({ ...prev, isAuthenticated: true, error: null }));
        setAuthRetryCount(0);
        setBackoff(1000);
        
        console.log('GPS51UnifiedData: Auto-authentication successful:', {
          hasToken: !!newAuthState.token,
          tokenLength: newAuthState.token?.length || 0
        });
        return true;
      } else {
        throw new Error('Authentication completed but no valid token received');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      console.error('GPS51UnifiedData: Auto-authentication failed:', error);
      
      setAuthRetryCount(prev => prev + 1);
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: false, 
        error: `Authentication failed: ${errorMessage}` 
      }));
      
      return false;
    }
  }, []);

  // Smart polling with real-time updates and auto-recovery
  const pollData = useCallback(async (deviceIds?: string[]) => {
    try {
      // Auto-authenticate if needed
      const isAuth = await autoAuthenticate();
      if (!isAuth) {
        // Retry authentication with exponential backoff
        if (authRetryCount < 5) {
          setTimeout(() => {
            setBackoff(prev => Math.min(prev * 2, 30000));
          }, backoff);
        }
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch live positions with auto-recovery
      const result = await gps51ProductionService.fetchLivePositions(deviceIds);

      setState(prev => ({
        ...prev,
        positions: result.positions,
        lastUpdate: new Date(),
        isLoading: false,
        isAuthenticated: true
      }));

      // Update lastQueryTime from server response for incremental polling
      setLastQueryTime(result.lastQueryTime);

      console.log('GPS51Data: Live poll completed', {
        positionsReceived: result.positions.length,
        lastQueryTime: result.lastQueryTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Live polling failed';
      console.error('GPS51Data: Live polling failed:', error);
      
      // Check if auth error and retry
      if (errorMessage.includes('not authenticated') || errorMessage.includes('token')) {
        setState(prev => ({ ...prev, isAuthenticated: false }));
        await autoAuthenticate();
      } else {
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false
        }));
      }
    }
  }, [lastQueryTime, autoAuthenticate, authRetryCount, backoff]);

  const startPolling = useCallback((deviceIds?: string[]) => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // Initial poll with lastQueryTime=0 for fresh start
    setLastQueryTime(0);
    pollData(deviceIds);

    // PRODUCTION: Real-time polling every 15 seconds for live tracking
    const timer = setInterval(() => {
      pollData(deviceIds);
    }, 15000); // 15 seconds for production-ready live experience

    setPollingTimer(timer);
    console.log('GPS51Data: Started real-time polling with 15s interval');
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
      // Auto-authenticate first
      const isAuth = await autoAuthenticate();
      if (!isAuth) {
        console.warn('GPS51Data: Cannot refresh - authentication failed');
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch devices and positions using unified service
      const devices = await gps51ProductionService.fetchUserDevices();
      const positionsResult = await gps51ProductionService.fetchLivePositions();

      setState(prev => ({
        ...prev,
        devices,
        positions: positionsResult.positions,
        lastUpdate: new Date(),
        isLoading: false,
        isAuthenticated: true
      }));

      setLastQueryTime(positionsResult.lastQueryTime);

      console.log('GPS51Data: Background refresh completed', {
        devices: devices.length,
        positions: positionsResult.positions.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Background refresh failed';
      console.error('GPS51Data: Background refresh failed:', error);
      
      // Try to recover authentication on error
      if (errorMessage.includes('not authenticated') || errorMessage.includes('token')) {
        setState(prev => ({ ...prev, isAuthenticated: false }));
        await autoAuthenticate();
      } else {
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false
        }));
      }
    }
  }, [autoAuthenticate]);

  const authenticateIfNeeded = useCallback(async (): Promise<boolean> => {
    return await autoAuthenticate();
  }, [autoAuthenticate]);

  // Auto-initialize with authentication and start live tracking
  useEffect(() => {
    const initializeRealTimeTracking = async () => {
      console.log('GPS51UnifiedData: Initializing real-time tracking...');
      
      // Auto-authenticate and start live tracking
      const isAuth = await autoAuthenticate();
      if (isAuth) {
        // Load initial data
        await refreshData();
        
        // Start real-time polling automatically
        console.log('GPS51UnifiedData: Starting automatic live tracking');
        startPolling();
      } else {
        console.warn('GPS51UnifiedData: Failed to initialize - authentication required');
      }
    };
    
    initializeRealTimeTracking();
  }, []);

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