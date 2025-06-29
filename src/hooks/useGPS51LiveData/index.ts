
import { useEffect, useCallback } from 'react';
import { useWebSocketConnection } from '../useWebSocketConnection';
import { useIntelligentFiltering } from '../useIntelligentFiltering';
import { scalingService } from '@/services/scaling/ScalingService';
import { costOptimizationService } from '@/services/optimization/CostOptimizationService';
import { advancedAnalyticsService } from '@/services/analytics/AdvancedAnalyticsService';
import { useGPS51LiveDataState } from './useGPS51LiveDataState';
import { usePositionHandlers } from './usePositionHandlers';
import { useDataFetcher } from './useDataFetcher';
import { LiveDataOptions } from './types';

export const useGPS51LiveData = (options: LiveDataOptions = {}) => {
  const { 
    enabled = true, 
    refreshInterval = 30000, 
    maxRetries = 3,
    enableWebSocket = true,
    enableIntelligentFiltering = true
  } = options;

  const {
    positions,
    setPositions,
    metrics,
    setMetrics,
    loading,
    setLoading,
    error,
    setError,
    retries,
    setRetries,
    lastSyncTime,
    setLastSyncTime
  } = useGPS51LiveDataState();

  const { handlePositionUpdate, handleConnectionChange } = usePositionHandlers(
    setPositions,
    setLastSyncTime,
    setMetrics
  );

  const { fetchLiveData } = useDataFetcher(
    enableIntelligentFiltering,
    maxRetries,
    retries,
    setLoading,
    setError,
    setPositions,
    setMetrics,
    setLastSyncTime,
    setRetries
  );

  // Initialize WebSocket connection
  const {
    connected: wsConnected,
    subscribeToVehicles,
    requestVehicleUpdate
  } = useWebSocketConnection({
    autoReconnect: enableWebSocket,
    onPositionUpdate: handlePositionUpdate,
    onConnectionChange: handleConnectionChange
  });

  // Initialize intelligent filtering
  const { getVehiclesByPriority } = useIntelligentFiltering();

  useEffect(() => {
    if (!enabled) return;

    fetchLiveData();

    const interval = setInterval(fetchLiveData, refreshInterval);
    
    return () => {
      clearInterval(interval);
    };
  }, [fetchLiveData, refreshInterval, enabled]);

  const refresh = useCallback(() => {
    console.log('Manually refreshing live data...');
    setRetries(0);
    fetchLiveData();
  }, [fetchLiveData, setRetries]);

  const triggerPrioritySync = useCallback((vehicleIds: string[]) => {
    if (enableWebSocket && wsConnected) {
      requestVehicleUpdate(vehicleIds);
    }
  }, [enableWebSocket, wsConnected, requestVehicleUpdate]);

  return {
    positions,
    metrics,
    loading,
    error,
    lastSyncTime,
    refresh,
    triggerPrioritySync,
    intelligentFiltering: enableIntelligentFiltering ? {
      getVehiclesByPriority
    } : null,
    // Phase 5 additions
    scalingMetrics: scalingService.getMetrics(),
    budgetStatus: costOptimizationService.getBudgetStatus(),
    optimizationInsights: advancedAnalyticsService.generateOptimizationInsights()
  };
};

// Export types
export * from './types';
