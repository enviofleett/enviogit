import { useState, useEffect, useCallback, useRef } from 'react';
import { GPS51OptimizedApiClient } from '@/services/gps51/GPS51OptimizedApiClient';
import { GPS51_DEFAULTS } from '@/services/gps51/GPS51Constants';

interface UseGPS51OptimizedOptions {
  baseUrl?: string;
  autoRefreshInterval?: number;
  maxRetries?: number;
  enableAutoRefresh?: boolean;
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

interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: string;
  status: string;
  groupname?: string;
}

export function useGPS51Optimized({
  baseUrl = GPS51_DEFAULTS.BASE_URL,
  autoRefreshInterval = 30000,
  maxRetries = 3,
  enableAutoRefresh = true
}: UseGPS51OptimizedOptions = {}) {
  const [client] = useState(() => new GPS51OptimizedApiClient(baseUrl));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<GPS51Device[]>([]);
  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [metrics, setMetrics] = useState(client.getMetrics());
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const lastRefreshRef = useRef<number>(0);

  // Debounced error setter to prevent rapid error state changes
  const debouncedSetError = useCallback((errorMessage: string | null) => {
    const timeoutId = setTimeout(() => setError(errorMessage), 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Enhanced login with comprehensive error handling
  const login = useCallback(async (
    username: string, 
    password: string, 
    from: string = "WEB", 
    type: string = "USER"
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('useGPS51Optimized: Starting login process...');
      
      await client.login(username, password, from, type);
      setIsAuthenticated(true);
      retryCountRef.current = 0;
      
      console.log('useGPS51Optimized: Login successful');
      
      // Immediately fetch devices after successful login
      await fetchDevices(username);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('useGPS51Optimized: Login failed:', errorMessage);
      
      setError(errorMessage);
      setIsAuthenticated(false);
      
      // Intelligent retry logic for transient errors
      if (retryCountRef.current < maxRetries && !errorMessage.includes('authentication')) {
        retryCountRef.current++;
        const delay = 2000 * Math.pow(2, retryCountRef.current - 1);
        
        console.log(`useGPS51Optimized: Retrying login in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          login(username, password, from, type);
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [client, maxRetries]);

  // Optimized device fetching with caching
  const fetchDevices = useCallback(async (username: string, useCache: boolean = true) => {
    if (!isAuthenticated) {
      console.warn('useGPS51Optimized: Cannot fetch devices - not authenticated');
      return;
    }

    try {
      console.log('useGPS51Optimized: Fetching devices...');
      
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
              groupname: group.groupname
            }));
            allDevices.push(...groupDevices);
          }
        });
        
        setDevices(allDevices);
        console.log(`useGPS51Optimized: Loaded ${allDevices.length} devices`);
        
        // Auto-fetch positions for all devices
        if (allDevices.length > 0) {
          await fetchPositions(allDevices.map(d => d.deviceid));
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch devices';
      console.error('useGPS51Optimized: Device fetch failed:', errorMessage);
      debouncedSetError(errorMessage);
    }
  }, [client, isAuthenticated, debouncedSetError]);

  // Batch position fetching with intelligent caching
  const fetchPositions = useCallback(async (
    deviceIds: string[] = [],
    useCache: boolean = true
  ): Promise<GPS51Position[]> => {
    if (!isAuthenticated) {
      console.warn('useGPS51Optimized: Cannot fetch positions - not authenticated');
      return [];
    }

    // Prevent too frequent requests
    const now = Date.now();
    if (now - lastRefreshRef.current < 2000) { // 2 second minimum between requests
      console.log('useGPS51Optimized: Skipping position fetch - too frequent');
      return positions;
    }
    
    lastRefreshRef.current = now;

    try {
      console.log(`useGPS51Optimized: Fetching positions for ${deviceIds.length} devices`);
      
      const response = await client.getLastPosition(
        deviceIds.length > 0 ? deviceIds : devices.map(d => d.deviceid),
        0,
        useCache
      );
      
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
        
        setPositions(newPositions);
        console.log(`useGPS51Optimized: Updated ${newPositions.length} positions`);
        
        // Update metrics
        setMetrics(client.getMetrics());
        
        return newPositions;
      }
      
      return [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      console.error('useGPS51Optimized: Position fetch failed:', errorMessage);
      
      // Don't set error for position fetches unless it's critical
      if (errorMessage.includes('authentication') || errorMessage.includes('Circuit breaker')) {
        debouncedSetError(errorMessage);
      }
      
      return [];
    }
  }, [client, isAuthenticated, devices, positions, debouncedSetError]);

  // Historical data fetching
  const fetchHistoryTracks = useCallback(async (
    deviceId: string,
    beginTime: string,
    endTime: string,
    timezone: number = 8
  ) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      console.log(`useGPS51Optimized: Fetching history for device ${deviceId}`);
      
      const response = await client.getHistoryTracks(deviceId, beginTime, endTime, timezone);
      
      if (response.status === 0) {
        return response.records || [];
      }
      
      throw new Error(response.message || 'Failed to fetch history tracks');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch history';
      console.error('useGPS51Optimized: History fetch failed:', errorMessage);
      throw err;
    }
  }, [client, isAuthenticated]);

  // Auto-refresh with intelligent intervals
  useEffect(() => {
    if (isAuthenticated && enableAutoRefresh && autoRefreshInterval > 0) {
      console.log(`useGPS51Optimized: Starting auto-refresh every ${autoRefreshInterval}ms`);
      
      intervalRef.current = setInterval(() => {
        if (devices.length > 0) {
          fetchPositions(devices.map(d => d.deviceid), true);
        }
      }, autoRefreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, enableAutoRefresh, autoRefreshInterval, devices, fetchPositions]);

  // Manual refresh with loading state
  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn('useGPS51Optimized: Cannot refresh - not authenticated');
      return;
    }

    setLoading(true);
    try {
      console.log('useGPS51Optimized: Manual refresh triggered');
      
      // Refresh devices first, then positions
      const username = sessionStorage.getItem('gps51_username') || 'unknown';
      await fetchDevices(username, false); // Force fresh data
      
      if (devices.length > 0) {
        await fetchPositions(devices.map(d => d.deviceid), false); // Force fresh data
      }
      
      console.log('useGPS51Optimized: Manual refresh completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Refresh failed';
      console.error('useGPS51Optimized: Refresh failed:', errorMessage);
      debouncedSetError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, devices, fetchDevices, fetchPositions, debouncedSetError]);

  // Health monitoring
  const checkHealth = useCallback(async () => {
    try {
      const health = await client.healthCheck();
      setMetrics(health.metrics);
      
      if (!health.healthy) {
        console.warn('useGPS51Optimized: Health check failed:', health.error);
      }
      
      return health;
    } catch (err) {
      console.error('useGPS51Optimized: Health check error:', err);
      return {
        healthy: false,
        error: err instanceof Error ? err.message : 'Health check failed',
        metrics: client.getMetrics()
      };
    }
  }, [client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      client.logout();
    };
  }, [client]);

  return {
    // Authentication state
    isAuthenticated,
    loading,
    error,
    
    // Data
    devices,
    positions,
    metrics,
    
    // Actions
    login,
    logout: client.logout.bind(client),
    refresh,
    fetchDevices,
    fetchPositions,
    fetchHistoryTracks,
    checkHealth,
    
    // Cache management
    clearCache: client.clearCache.bind(client),
    
    // Raw client access for advanced usage
    client
  };
}