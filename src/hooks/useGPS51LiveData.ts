/**
 * Primary GPS51 Live Data Hook - CONSOLIDATED VERSION
 * Uses single GPS51ProductionService for all operations
 * Eliminates redundancy and ensures reliable API access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51ProductionService, GPS51Vehicle, GPS51Position, LiveDataResult, GPS51AuthState } from '@/services/gps51/GPS51ProductionService';

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
    isLoading: true, // AGGRESSIVE: Start with loading state
    isPolling: false,
    error: null,
    authState: gps51ProductionService.getAuthState(),
    lastUpdate: null,
    pollingInterval: 45000, // FIXED: 45 seconds default (was 10s)
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

      const authState = await gps51ProductionService.authenticate(username, password);
      
      // Fetch user devices after successful authentication
      await gps51ProductionService.fetchUserDevices();
      
      setState(prev => ({
        ...prev,
        authState,
        isLoading: false,
        vehicles: gps51ProductionService.getDevices()
      }));

      console.log('useGPS51LiveData: Authentication and device fetch completed');
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        authState: gps51ProductionService.getAuthState()
      }));
      
      console.error('useGPS51LiveData: Authentication failed:', error);
      return false;
    }
  }, []);

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
   * Polling function with smart intervals and retry logic
   */
  const pollData = useCallback(async (targetDeviceIds?: string[]) => {
    if (!isPollingRef.current) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const result: LiveDataResult = await gps51ProductionService.fetchLivePositions(targetDeviceIds);

      if (result.isSuccess) {
        const newInterval = enableSmartPolling 
          ? gps51ProductionService.calculatePollingInterval()
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
        const retryDelay = gps51ProductionService.calculateRetryDelay();
        const shouldRetry = gps51ProductionService.shouldRetry();

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
  }, [enableSmartPolling, stopPolling]);

  /**
   * Start polling with smart intervals - AGGRESSIVE VERSION
   */
  const startPolling = useCallback((targetDeviceIds?: string[]) => {
    // AGGRESSIVE: Check unified service auth state instead of local state
    const currentAuthState = gps51ProductionService.getAuthState();
    
    if (!currentAuthState.isAuthenticated) {
      console.warn('useGPS51LiveData: Cannot start polling - not authenticated, trying again in 5s');
      // AGGRESSIVE: Retry after 5 seconds instead of giving up
      setTimeout(() => {
        const retryAuthState = gps51ProductionService.getAuthState();
        if (retryAuthState.isAuthenticated) {
          console.log('useGPS51LiveData: Retry authentication successful, starting polling');
          startPolling(targetDeviceIds);
        }
      }, 5000);
      return;
    }

    if (isPollingRef.current) {
      stopPolling(); // Stop existing polling
    }

    isPollingRef.current = true;
    setState(prev => ({ ...prev, isPolling: true, retryCount: 0 }));

    // Reset query time for fresh start
    gps51ProductionService.resetQueryTime();

    console.log('useGPS51LiveData: Starting smart polling for', targetDeviceIds || 'all devices');
    
    // Start immediate poll
    pollData(targetDeviceIds);
  }, [pollData, stopPolling]);

  /**
   * Manual data refresh
   */
  const refreshData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Reset query time for full refresh
      gps51ProductionService.resetQueryTime();
      
      const result = await gps51ProductionService.fetchLivePositions(deviceIds);

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
      await gps51ProductionService.logout();
      
      setState({
        vehicles: [],
        positions: [],
        isLoading: false,
        isPolling: false,
        error: null,
        authState: gps51ProductionService.getAuthState(),
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
    console.log('useGPS51LiveData: Clear caches called (handled by production service)');
  }, []);

  /**
   * Reset query time
   */
  const resetQueryTime = useCallback(() => {
    gps51ProductionService.resetQueryTime();
    console.log('useGPS51LiveData: Query time reset');
  }, []);

  /**
   * PRODUCTION FIX: Auto-authenticate with stored credentials - BETTER ERROR HANDLING
   */
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('useGPS51LiveData: Initializing authentication...');
      
      try {
        // Check if GPS51 is already configured using new credential checker
        const { GPS51CredentialChecker } = await import('@/services/gps51/GPS51CredentialChecker');
        const { GPS51ConfigStorage } = await import('@/services/gps51/configStorage');
        
        const credentialStatus = GPS51CredentialChecker.checkCredentials();
        
        if (!credentialStatus.isConfigured) {
          const errorMessage = GPS51CredentialChecker.getCredentialErrorMessage();
          console.log('useGPS51LiveData: GPS51 credentials not properly configured:', credentialStatus);
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: errorMessage
          }));
          return;
        }

        const config = GPS51ConfigStorage.getConfiguration();
        if (!config || !config.password || config.password.length === 0) {
          console.log('useGPS51LiveData: Configuration incomplete');
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'GPS51 configuration incomplete. Please ensure username and password are set in Settings.'
          }));
          return;
        }

        // Check current auth state
        const currentAuthState = gps51ProductionService.getAuthState();
        
        if (!currentAuthState.isAuthenticated) {
          console.log('useGPS51LiveData: Auto-authenticating with stored credentials...');
          try {
            const success = await authenticate(config.username, config.password);
            if (success) {
              console.log('useGPS51LiveData: Auto-authentication successful');
              // Don't auto-start polling here, let the polling effect handle it
            } else {
              console.warn('useGPS51LiveData: Auto-authentication failed - invalid credentials');
              setState(prev => ({
                ...prev,
                error: 'GPS51 authentication failed. Please check your credentials in Settings.',
                isLoading: false
              }));
            }
          } catch (error) {
            console.warn('useGPS51LiveData: Auto-authentication error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
            
            // Better error message for common issues
            let userFriendlyError = errorMessage;
            if (errorMessage.includes('Proxy request failed')) {
              userFriendlyError = 'GPS51 connection failed. Please check your credentials and try again.';
            } else if (errorMessage.includes('Edge Function')) {
              userFriendlyError = 'GPS51 service unavailable. Please try again later.';
            }
            
            setState(prev => ({
              ...prev,
              error: userFriendlyError,
              isLoading: false
            }));
          }
        } else {
          // Already authenticated, fetch devices
          console.log('useGPS51LiveData: Already authenticated, fetching devices...');
          try {
            await gps51ProductionService.fetchUserDevices();
            setState(prev => ({
              ...prev,
              authState: currentAuthState,
              vehicles: gps51ProductionService.getDevices(),
              isLoading: false,
              error: null // Clear any previous errors
            }));
          } catch (error) {
            console.warn('useGPS51LiveData: Device fetch failed:', error);
            setState(prev => ({
              ...prev,
              error: error instanceof Error ? error.message : 'Failed to fetch devices',
              isLoading: false
            }));
          }
        }
      } catch (error) {
        console.error('useGPS51LiveData: Initialization error:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize GPS51 connection',
          isLoading: false
        }));
      }
    };

    // Initialize based on provided credentials or stored config
    if (username && password) {
      console.log('useGPS51LiveData: Auto-starting with provided credentials');
      authenticate(username, password).then(success => {
        // Polling will be handled by the autoRefresh effect
      }).catch(error => {
        console.error('useGPS51LiveData: Provided credentials failed:', error);
      });
    } else {
      // Try to auto-initialize with stored credentials
      initializeAuth();
    }
  }, [username, password, authenticate]); // Removed deviceIds and startPolling dependencies

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
  const serviceStatus = gps51ProductionService.getServiceStatus();

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