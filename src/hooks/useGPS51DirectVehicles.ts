import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGPS51UnifiedData } from './useGPS51UnifiedData';
import type { GPS51Device } from '../services/gps51/GPS51Types';
import { useToast } from './use-toast';

// Legacy support for vehicle stats
export interface VehicleStats {
  total: number;
  online: number;
  offline: number;
  recentlyActive: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

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

/**
 * PHASE 1 EMERGENCY FIX: GPS51 Direct Vehicles Hook
 * Now uses the unified polling coordinator to prevent API throttling
 */
export function useGPS51DirectVehicles(
  options: UseGPS51DirectVehiclesOptions = {}
): UseGPS51DirectVehiclesReturn {
  const { toast } = useToast();
  const {
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes - NOT USED, controlled by unified coordinator
    enableCaching = true,
    onVehiclesUpdated,
    onError
  } = options;

  // PHASE 1 FIX: Use unified data hook instead of individual polling
  const { state: unifiedState, actions: unifiedActions } = useGPS51UnifiedData({
    enabled: autoRefresh,
    priority: 'normal',
    onDataUpdated: (data) => {
      if (data.vehicles && onVehiclesUpdated) {
        onVehiclesUpdated(data.vehicles);
      }
    },
    onError
  });

  // Calculate vehicle statistics
  const vehicleStats = useMemo((): VehicleStats | null => {
    if (!unifiedState.vehicles || unifiedState.vehicles.length === 0) {
      return null;
    }

    const vehicles = unifiedState.vehicles;
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    const fourHoursAgo = now - (4 * 60 * 60 * 1000);

    const stats: VehicleStats = {
      total: vehicles.length,
      online: 0,
      offline: 0,
      recentlyActive: 0,
      byType: {},
      byStatus: {}
    };

    vehicles.forEach(device => {
      // Activity analysis
      const lastActiveTime = device.lastactivetime || 0;
      const isOnline = lastActiveTime > fourHoursAgo;
      const isRecentlyActive = lastActiveTime > thirtyMinutesAgo;

      if (isOnline) {
        stats.online++;
      } else {
        stats.offline++;
      }

      if (isRecentlyActive) {
        stats.recentlyActive++;
      }

      // Type statistics
      const type = device.devicetype || 'Unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Status statistics  
      const status = device.strstatus || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;
  }, [unifiedState.vehicles]);

  // Map unified state to legacy vehicle state format
  const vehicleState: UseGPS51DirectVehiclesState = useMemo(() => ({
    vehicles: unifiedState.vehicles,
    isLoading: unifiedState.isLoading,
    isRefreshing: false, // Unified coordinator doesn't distinguish between loading/refreshing
    error: unifiedState.error,
    lastUpdated: unifiedState.lastVehicleUpdate,
    stats: vehicleStats,
    fromCache: true // Data comes from unified coordinator cache
  }), [unifiedState, vehicleStats]);

  // Manual refresh - delegates to unified coordinator
  const refresh = useCallback(async (forceRefresh = false): Promise<void> => {
    console.log('useGPS51DirectVehicles: Manual refresh requested (delegating to unified coordinator)');
    
    try {
      await unifiedActions.refresh('vehicles');
      
      toast({
        title: "Vehicles Refreshed",
        description: `Vehicle data updated successfully`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      console.error('useGPS51DirectVehicles: Refresh failed:', errorMessage);
      
      toast({
        title: "Refresh Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  }, [unifiedActions, toast]);

  // Search vehicles in current cached data
  const searchVehicles = useCallback(async (query: string): Promise<GPS51Device[]> => {
    console.log('useGPS51DirectVehicles: Searching vehicles:', query);
    
    const lowercaseQuery = query.toLowerCase();
    const results = unifiedState.vehicles.filter(device =>
      device.devicename.toLowerCase().includes(lowercaseQuery) ||
      device.deviceid.toLowerCase().includes(lowercaseQuery) ||
      device.devicetype.toLowerCase().includes(lowercaseQuery) ||
      (device.simnum && device.simnum.toLowerCase().includes(lowercaseQuery))
    );
    
    console.log('useGPS51DirectVehicles: Search results:', results.length);
    return results;
  }, [unifiedState.vehicles]);

  // Get vehicle by ID from cached data
  const getVehicleById = useCallback((deviceId: string): GPS51Device | null => {
    return unifiedActions.getVehicleById(deviceId);
  }, [unifiedActions]);

  // Clear cache - delegates to unified coordinator  
  const clearCache = useCallback(() => {
    console.log('useGPS51DirectVehicles: Cache clear requested (handled by unified coordinator)');
    
    toast({
      title: "Cache Clear Requested",
      description: "Vehicle cache is managed by the unified coordinator",
    });
  }, [toast]);

  // Clear error
  const clearError = useCallback(() => {
    unifiedActions.clearError();
  }, [unifiedActions]);

  const actions: UseGPS51DirectVehiclesActions = {
    refresh,
    searchVehicles,
    getVehicleById,
    clearCache,
    clearError
  };

  const hasVehicles = vehicleState.vehicles.length > 0;
  const isEmpty = !vehicleState.isLoading && vehicleState.vehicles.length === 0;
  const isReady = hasVehicles && !vehicleState.isLoading && !vehicleState.error;

  return {
    state: vehicleState,
    actions,
    hasVehicles,
    isEmpty,
    isReady
  };
}