import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51UnifiedPollingCoordinator } from '../services/gps51/GPS51UnifiedPollingCoordinator';
import type { GPS51Device, GPS51Position } from '../services/gps51/GPS51Types';
import { useToast } from './use-toast';

export interface UnifiedDataState {
  vehicles: GPS51Device[];
  positions: GPS51Position[];
  isLoading: boolean;
  error: string | null;
  lastVehicleUpdate: number | null;
  lastPositionUpdate: number | null;
  hasVehicles: boolean;
  hasPositions: boolean;
}

export interface UnifiedDataActions {
  refresh: (type?: 'vehicles' | 'positions' | 'combined') => Promise<void>;
  clearError: () => void;
  getVehicleById: (deviceId: string) => GPS51Device | null;
  getLatestPosition: (deviceId: string) => GPS51Position | null;
}

export interface UseGPS51UnifiedDataOptions {
  enabled?: boolean;
  priority?: 'low' | 'normal' | 'high';
  onDataUpdated?: (data: any) => void;
  onError?: (error: string) => void;
}

export interface UseGPS51UnifiedDataReturn {
  state: UnifiedDataState;
  actions: UnifiedDataActions;
  isReady: boolean;
  isEmpty: boolean;
}

/**
 * PHASE 1 EMERGENCY FIX: Unified GPS51 Data Hook
 * Uses the centralized polling coordinator to prevent API throttling
 */
export function useGPS51UnifiedData(
  options: UseGPS51UnifiedDataOptions = {}
): UseGPS51UnifiedDataReturn {
  const { toast } = useToast();
  const {
    enabled = true,
    priority = 'normal',
    onDataUpdated,
    onError
  } = options;

  const [state, setState] = useState<UnifiedDataState>({
    vehicles: [],
    positions: [],
    isLoading: false,
    error: null,
    lastVehicleUpdate: null,
    lastPositionUpdate: null,
    hasVehicles: false,
    hasPositions: false
  });

  const subscriptionId = useRef<string | null>(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (subscriptionId.current) {
        gps51UnifiedPollingCoordinator.unsubscribe(subscriptionId.current);
      }
    };
  }, []);

  // Data update handler
  const handleDataUpdate = useCallback((data: any) => {
    if (!isMounted.current) return;

    console.log('useGPS51UnifiedData: Data update received:', {
      vehicles: data.vehicles?.length || 0,
      positions: data.positions?.length || 0
    });

    setState(prev => ({
      ...prev,
      vehicles: data.vehicles || prev.vehicles || [],
      positions: data.positions || prev.positions || [],
      lastVehicleUpdate: data.lastVehicleUpdate || data.lastUpdated || prev.lastVehicleUpdate,
      lastPositionUpdate: data.lastPositionUpdate || data.lastUpdated || prev.lastPositionUpdate,
      hasVehicles: (data.vehicles || prev.vehicles || []).length > 0,
      hasPositions: (data.positions || prev.positions || []).length > 0,
      error: null,
      isLoading: false
    }));

    // Trigger callback if provided
    if (onDataUpdated) {
      onDataUpdated(data);
    }
  }, [onDataUpdated]);

  // Error handler
  const handleError = useCallback((error: string) => {
    if (!isMounted.current) return;

    console.error('useGPS51UnifiedData: Error occurred:', error);

    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));

    if (onError) {
      onError(error);
    }

    // Show toast for serious errors only
    if (error.includes('emergency') || error.includes('throttle')) {
      toast({
        title: "GPS51 API Issues",
        description: error,
        variant: "destructive",
      });
    }
  }, [onError, toast]);

  // Subscribe to unified coordinator
  useEffect(() => {
    if (!enabled) return;

    console.log('useGPS51UnifiedData: Subscribing to unified coordinator...');

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      subscriptionId.current = gps51UnifiedPollingCoordinator.subscribe(
        'combined',
        handleDataUpdate,
        { priority }
      );

      console.log('useGPS51UnifiedData: Subscribed with ID:', subscriptionId.current);

    } catch (error) {
      console.error('useGPS51UnifiedData: Subscription failed:', error);
      handleError(error instanceof Error ? error.message : 'Subscription failed');
    }

    return () => {
      if (subscriptionId.current) {
        gps51UnifiedPollingCoordinator.unsubscribe(subscriptionId.current);
        subscriptionId.current = null;
      }
    };
  }, [enabled, priority, handleDataUpdate]);

  // Manual refresh
  const refresh = useCallback(async (type: 'vehicles' | 'positions' | 'combined' = 'combined') => {
    if (!enabled) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log(`useGPS51UnifiedData: Manual refresh requested: ${type}`);
      await gps51UnifiedPollingCoordinator.refresh(type);
      
      toast({
        title: "Data Refreshed",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} data updated successfully`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      console.error('useGPS51UnifiedData: Manual refresh failed:', errorMessage);
      
      handleError(errorMessage);
      
      toast({
        title: "Refresh Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [enabled, handleError, toast]);

  // Get vehicle by ID
  const getVehicleById = useCallback((deviceId: string): GPS51Device | null => {
    return state.vehicles.find(vehicle => vehicle.deviceid === deviceId) || null;
  }, [state.vehicles]);

  // Get latest position for device
  const getLatestPosition = useCallback((deviceId: string): GPS51Position | null => {
    return state.positions.find(position => position.deviceid === deviceId) || null;
  }, [state.positions]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: UnifiedDataActions = {
    refresh,
    clearError,
    getVehicleById,
    getLatestPosition
  };

  const isReady = state.hasVehicles && !state.isLoading && !state.error;
  const isEmpty = !state.isLoading && !state.hasVehicles;

  return {
    state,
    actions,
    isReady,
    isEmpty
  };
}