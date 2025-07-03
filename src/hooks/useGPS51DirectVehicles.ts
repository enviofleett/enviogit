import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51DirectManager } from '../services/gps51/direct';
import type { 
  GPS51Device, 
  VehicleQueryResult, 
  VehicleStats 
} from '../services/gps51/direct';
import { useToast } from './use-toast';

export interface UseGPS51DirectVehiclesState {
  vehicles: GPS51Device[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
  stats: VehicleStats | null;
  fromCache: boolean;
}

export interface UseGPS51DirectVehiclesActions {
  refresh: (forceRefresh?: boolean) => Promise<void>;
  searchVehicles: (query: string) => Promise<GPS51Device[]>;
  getVehicleById: (deviceId: string) => GPS51Device | null;
  clearCache: () => void;
  clearError: () => void;
}

export interface UseGPS51DirectVehiclesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableCaching?: boolean;
  onVehiclesUpdated?: (vehicles: GPS51Device[]) => void;
  onError?: (error: string) => void;
}

export interface UseGPS51DirectVehiclesReturn {
  state: UseGPS51DirectVehiclesState;
  actions: UseGPS51DirectVehiclesActions;
  // Convenience properties
  hasVehicles: boolean;
  isEmpty: boolean;
  isReady: boolean;
}

export function useGPS51DirectVehicles(
  options: UseGPS51DirectVehiclesOptions = {}
): UseGPS51DirectVehiclesReturn {
  const { toast } = useToast();
  const {
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
    enableCaching = true,
    onVehiclesUpdated,
    onError
  } = options;

  const [state, setState] = useState<UseGPS51DirectVehiclesState>({
    vehicles: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
    stats: null,
    fromCache: false
  });

  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);

  // Process vehicle query result
  const processVehicleResult = useCallback((result: VehicleQueryResult) => {
    const stats = gps51DirectManager.vehicles.getVehicleStats(result.devices);
    
    setState(prev => ({
      ...prev,
      vehicles: result.devices,
      stats,
      lastUpdated: result.lastUpdated,
      fromCache: result.fromCache,
      error: null
    }));

    // Trigger callback if provided
    if (onVehiclesUpdated) {
      onVehiclesUpdated(result.devices);
    }

    return result;
  }, [onVehiclesUpdated]);

  // Main refresh function
  const refresh = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!gps51DirectManager.auth.isAuthenticated()) {
      const error = 'Not authenticated. Please login first.';
      setState(prev => ({ ...prev, error }));
      if (onError) onError(error);
      return;
    }

    // Determine if this is initial load or refresh
    const isInitialLoad = state.vehicles.length === 0 && !state.lastUpdated;
    
    setState(prev => ({
      ...prev,
      isLoading: isInitialLoad,
      isRefreshing: !isInitialLoad,
      error: null
    }));

    try {
      console.log('useGPS51DirectVehicles: Fetching vehicle list...', {
        forceRefresh,
        enableCaching,
        isInitialLoad
      });

      const result = await gps51DirectManager.vehicles.getVehicleList(forceRefresh);
      
      if (!isMounted.current) return;

      processVehicleResult(result);

      if (!result.fromCache) {
        toast({
          title: "Vehicles Updated",
          description: `${result.totalCount} vehicles loaded`,
        });
      }

      console.log('useGPS51DirectVehicles: Vehicle list updated:', {
        count: result.totalCount,
        fromCache: result.fromCache
      });

    } catch (error) {
      if (!isMounted.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vehicles';
      console.error('useGPS51DirectVehicles: Error fetching vehicles:', errorMessage);

      setState(prev => ({
        ...prev,
        error: errorMessage
      }));

      if (onError) {
        onError(errorMessage);
      }

      toast({
        title: "Error Loading Vehicles",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (isMounted.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isRefreshing: false
        }));
      }
    }
  }, [state.vehicles.length, state.lastUpdated, enableCaching, onError, toast, processVehicleResult]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && gps51DirectManager.auth.isAuthenticated()) {
      // Initial load
      refresh();

      // Set up periodic refresh
      if (refreshInterval > 0) {
        refreshTimer.current = setInterval(() => {
          if (gps51DirectManager.auth.isAuthenticated()) {
            refresh();
          }
        }, refreshInterval);
      }
    }

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
        refreshTimer.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, refresh]);

  // Search vehicles
  const searchVehicles = useCallback(async (query: string): Promise<GPS51Device[]> => {
    try {
      console.log('useGPS51DirectVehicles: Searching vehicles:', query);
      
      const results = await gps51DirectManager.vehicles.searchVehicles(query);
      
      console.log('useGPS51DirectVehicles: Search results:', results.length);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      console.error('useGPS51DirectVehicles: Search error:', errorMessage);
      
      toast({
        title: "Search Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      return [];
    }
  }, [toast]);

  // Get vehicle by ID
  const getVehicleById = useCallback((deviceId: string): GPS51Device | null => {
    return state.vehicles.find(vehicle => vehicle.deviceid === deviceId) || null;
  }, [state.vehicles]);

  // Clear cache
  const clearCache = useCallback(() => {
    gps51DirectManager.vehicles.clearCache();
    toast({
      title: "Cache Cleared",
      description: "Vehicle cache has been cleared",
    });
  }, [toast]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: UseGPS51DirectVehiclesActions = {
    refresh,
    searchVehicles,
    getVehicleById,
    clearCache,
    clearError
  };

  const hasVehicles = state.vehicles.length > 0;
  const isEmpty = !state.isLoading && state.vehicles.length === 0;
  const isReady = hasVehicles && !state.isLoading && !state.error;

  return {
    state,
    actions,
    hasVehicles,
    isEmpty,
    isReady
  };
}