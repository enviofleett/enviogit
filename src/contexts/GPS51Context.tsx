import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { GPS51OptimizedApiClient } from '@/services/gps51/GPS51OptimizedApiClient';
import { gps51ErrorHandler, GPS51Error } from '@/services/gps51/GPS51CentralizedErrorHandler';
import { GPS51_DEFAULTS } from '@/services/gps51/GPS51Constants';

interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: string;
  status: string;
  groupname?: string;
  lastactivetime?: number;
}

interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  speed: number;
  updatetime: string;
  address?: string;
  ignition_status?: boolean;
  heading?: number;
  fuel_level?: number;
  engine_temperature?: number;
}

interface GPS51State {
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  devices: GPS51Device[];
  positions: GPS51Position[];
  metrics: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
    cacheHitRate: number;
    circuitBreakerStatus: string;
    recentErrors: string[];
  };
  lastRefresh: number;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

type GPS51Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_DEVICES'; payload: GPS51Device[] }
  | { type: 'SET_POSITIONS'; payload: GPS51Position[] }
  | { type: 'SET_METRICS'; payload: GPS51State['metrics'] }
  | { type: 'SET_CONNECTION_STATUS'; payload: GPS51State['connectionStatus'] }
  | { type: 'UPDATE_LAST_REFRESH' }
  | { type: 'RESET_STATE' };

const initialState: GPS51State = {
  isAuthenticated: false,
  loading: false,
  error: null,
  devices: [],
  positions: [],
  metrics: {
    averageResponseTime: 0,
    successRate: 0,
    totalRequests: 0,
    cacheHitRate: 0,
    circuitBreakerStatus: 'Closed',
    recentErrors: []
  },
  lastRefresh: 0,
  connectionStatus: 'disconnected'
};

function gps51Reducer(state: GPS51State, action: GPS51Action): GPS51State {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, connectionStatus: action.payload ? 'error' : state.connectionStatus };
    case 'SET_AUTHENTICATED':
      return { 
        ...state, 
        isAuthenticated: action.payload,
        connectionStatus: action.payload ? 'connected' : 'disconnected',
        error: action.payload ? null : state.error
      };
    case 'SET_DEVICES':
      return { ...state, devices: action.payload };
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };
    case 'SET_METRICS':
      return { ...state, metrics: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'UPDATE_LAST_REFRESH':
      return { ...state, lastRefresh: Date.now() };
    case 'RESET_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface GPS51ContextValue {
  state: GPS51State;
  actions: {
    login: (username: string, password: string, from?: string, type?: string) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
    fetchDevices: (username: string, useCache?: boolean) => Promise<void>;
    fetchPositions: (deviceIds?: string[], useCache?: boolean) => Promise<GPS51Position[]>;
    fetchHistoryTracks: (deviceId: string, beginTime: string, endTime: string, timezone?: number) => Promise<any[]>;
    clearCache: () => void;
    checkHealth: () => Promise<any>;
  };
  client: GPS51OptimizedApiClient;
}

const GPS51Context = createContext<GPS51ContextValue | null>(null);

export function useGPS51() {
  const context = useContext(GPS51Context);
  if (!context) {
    throw new Error('useGPS51 must be used within a GPS51Provider');
  }
  return context;
}

interface GPS51ProviderProps {
  children: React.ReactNode;
  baseUrl?: string;
  autoRefreshInterval?: number;
  enableAutoRefresh?: boolean;
}

export function GPS51Provider({ 
  children, 
  baseUrl = GPS51_DEFAULTS.BASE_URL,
  autoRefreshInterval = 30000,
  enableAutoRefresh = true
}: GPS51ProviderProps) {
  const [state, dispatch] = useReducer(gps51Reducer, initialState);
  
  // Memoized client to prevent recreation
  const client = useMemo(() => new GPS51OptimizedApiClient(baseUrl), [baseUrl]);

  // Error handler setup
  useEffect(() => {
    const unsubscribe = gps51ErrorHandler.onError((error: GPS51Error) => {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      
      // Attempt recovery for recoverable errors
      if (error.recoverable) {
        gps51ErrorHandler.attemptRecovery(error, 0).then(recovered => {
          if (recovered) {
            dispatch({ type: 'SET_ERROR', payload: null });
          }
        });
      }
    });

    return unsubscribe;
  }, []);

  const handleError = useCallback((error: Error, context?: Record<string, any>) => {
    const gps51Error = gps51ErrorHandler.handleError(error, context);
    dispatch({ type: 'SET_ERROR', payload: gps51Error.message });
    return gps51Error;
  }, []);

  const login = useCallback(async (
    username: string, 
    password: string, 
    from: string = "WEB", 
    type: string = "USER"
  ) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
    
    try {
      await client.login(username, password, from, type);
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
      
      // Store username for future reference
      sessionStorage.setItem('gps51_username', username);
      
      // Immediately fetch devices after successful login
      await fetchDevices(username);
      
      console.log('GPS51Context: Login successful');
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Login failed'), {
        action: 'login',
        username
      });
      dispatch({ type: 'SET_AUTHENTICATED', payload: false });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [client, handleError]);

  const logout = useCallback(() => {
    client.logout();
    sessionStorage.removeItem('gps51_username');
    dispatch({ type: 'RESET_STATE' });
    console.log('GPS51Context: Logout completed');
  }, [client]);

  const fetchDevices = useCallback(async (username: string, useCache: boolean = true) => {
    if (!state.isAuthenticated) {
      console.warn('GPS51Context: Cannot fetch devices - not authenticated');
      return;
    }

    try {
      const response = await client.getDeviceList(username, useCache);
      
      if (response.status === 0 && response.groups) {
        const allDevices: GPS51Device[] = [];
        
        response.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            const groupDevices = group.devices.map((device: any) => ({
              deviceid: device.deviceid,
              devicename: device.devicename || device.deviceid,
              devicetype: device.devicetype || 'Unknown',
              status: device.status || 'Unknown',
              groupname: group.groupname,
              lastactivetime: device.lastactivetime
            }));
            allDevices.push(...groupDevices);
          }
        });
        
        dispatch({ type: 'SET_DEVICES', payload: allDevices });
        dispatch({ type: 'SET_METRICS', payload: client.getMetrics() });
        dispatch({ type: 'UPDATE_LAST_REFRESH' });
        
        console.log(`GPS51Context: Loaded ${allDevices.length} devices`);
        
        // Auto-fetch positions for devices
        if (allDevices.length > 0) {
          await fetchPositions(allDevices.map(d => d.deviceid));
        }
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to fetch devices'), {
        action: 'fetchDevices',
        username
      });
    }
  }, [client, state.isAuthenticated, handleError]);

  const fetchPositions = useCallback(async (
    deviceIds?: string[], 
    useCache: boolean = true
  ): Promise<GPS51Position[]> => {
    if (!state.isAuthenticated) {
      console.warn('GPS51Context: Cannot fetch positions - not authenticated');
      return [];
    }

    try {
      const targetDeviceIds = deviceIds || state.devices.map(d => d.deviceid);
      
      if (targetDeviceIds.length === 0) {
        return [];
      }

      const response = await client.getLastPosition(targetDeviceIds, 0, useCache);
      
      if (response.status === 0 && response.records) {
        const newPositions: GPS51Position[] = response.records.map((record: any) => ({
          deviceid: record.deviceid,
          callat: Number(record.callat || 0),
          callon: Number(record.callon || 0),
          speed: Number(record.speed || 0),
          updatetime: record.updatetime,
          address: record.address,
          ignition_status: record.ignition_status,
          heading: record.heading ? Number(record.heading) : undefined,
          fuel_level: record.fuel_level ? Number(record.fuel_level) : undefined,
          engine_temperature: record.engine_temperature ? Number(record.engine_temperature) : undefined,
        }));
        
        dispatch({ type: 'SET_POSITIONS', payload: newPositions });
        dispatch({ type: 'SET_METRICS', payload: client.getMetrics() });
        dispatch({ type: 'UPDATE_LAST_REFRESH' });
        
        console.log(`GPS51Context: Updated ${newPositions.length} positions`);
        return newPositions;
      }
      
      return [];
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to fetch positions'), {
        action: 'fetchPositions',
        deviceIds: deviceIds?.length || 0
      });
      return [];
    }
  }, [client, state.isAuthenticated, state.devices, handleError]);

  const fetchHistoryTracks = useCallback(async (
    deviceId: string,
    beginTime: string,
    endTime: string,
    timezone: number = 8
  ) => {
    if (!state.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await client.getHistoryTracks(deviceId, beginTime, endTime, timezone);
      
      if (response.status === 0) {
        return response.records || [];
      }
      
      throw new Error(response.message || 'Failed to fetch history tracks');
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to fetch history'), {
        action: 'fetchHistoryTracks',
        deviceId,
        beginTime,
        endTime
      });
      throw error;
    }
  }, [client, state.isAuthenticated, handleError]);

  const refresh = useCallback(async () => {
    if (!state.isAuthenticated) {
      console.warn('GPS51Context: Cannot refresh - not authenticated');
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const username = sessionStorage.getItem('gps51_username') || 'unknown';
      
      // Force fresh data
      await fetchDevices(username, false);
      
      console.log('GPS51Context: Manual refresh completed');
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Refresh failed'), {
        action: 'refresh'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.isAuthenticated, fetchDevices, handleError]);

  const clearCache = useCallback(() => {
    client.clearCache();
    console.log('GPS51Context: Cache cleared');
  }, [client]);

  const checkHealth = useCallback(async () => {
    try {
      const metrics = client.getMetrics();
      dispatch({ type: 'SET_METRICS', payload: metrics });
      
      const healthy = metrics.successRate > 80 && metrics.circuitBreakerStatus === 'Closed';
      
      return {
        healthy,
        metrics,
        connectionStatus: state.connectionStatus
      };
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Health check failed'), {
        action: 'checkHealth'
      });
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        metrics: client.getMetrics()
      };
    }
  }, [client, state.connectionStatus, handleError]);

  // Auto-refresh effect with optimized dependency management
  useEffect(() => {
    if (!state.isAuthenticated || !enableAutoRefresh || autoRefreshInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      if (state.devices.length > 0) {
        fetchPositions(state.devices.map(d => d.deviceid), true);
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, state.devices.length, enableAutoRefresh, autoRefreshInterval, fetchPositions]);

  const actions = useMemo(() => ({
    login,
    logout,
    refresh,
    fetchDevices,
    fetchPositions,
    fetchHistoryTracks,
    clearCache,
    checkHealth
  }), [login, logout, refresh, fetchDevices, fetchPositions, fetchHistoryTracks, clearCache, checkHealth]);

  const contextValue = useMemo(() => ({
    state,
    actions,
    client
  }), [state, actions, client]);

  return (
    <GPS51Context.Provider value={contextValue}>
      {children}
    </GPS51Context.Provider>
  );
}