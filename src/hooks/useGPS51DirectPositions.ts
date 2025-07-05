import { useState, useCallback, useRef, useMemo } from 'react';
import { useGPS51UnifiedData } from './useGPS51UnifiedData';
import type { GPS51Position } from '../services/gps51/GPS51Types';
import { useToast } from './use-toast';

// Legacy support types
export interface PositionFilter {
  minTime?: number;
  maxTime?: number;
  onlyMoving?: boolean;
}

export interface UseGPS51DirectPositionsState {
  positions: GPS51Position[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  lastUpdated: number | null;
  hasNewData: boolean;
  filteredCount: number;
  totalReceived: number;
  pollingStats: {
    interval: number;
    consecutiveEmpty: number;
    successRate: number;
  };
}

export interface UseGPS51DirectPositionsActions {
  startPolling: (deviceIds?: string[], filter?: PositionFilter) => void;
  stopPolling: () => void;
  refreshPositions: (deviceIds?: string[], filter?: PositionFilter) => Promise<void>;
  getPositionHistory: (deviceId: string, limit?: number) => GPS51Position[];
  getLatestPosition: (deviceId: string) => GPS51Position | null;
  clearHistory: () => void;
  clearError: () => void;
}

export interface UseGPS51DirectPositionsOptions {
  autoStart?: boolean;
  defaultDeviceIds?: string[];
  defaultFilter?: PositionFilter;
  pollingInterval?: number;
  adaptivePolling?: boolean;
  onPositionsUpdated?: (positions: GPS51Position[]) => void;
  onError?: (error: string) => void;
}

export interface UseGPS51DirectPositionsReturn {
  state: UseGPS51DirectPositionsState;
  actions: UseGPS51DirectPositionsActions;
  hasPositions: boolean;
  isEmpty: boolean;
  isActive: boolean;
}

/**
 * PHASE 1 EMERGENCY FIX: GPS51 Direct Positions Hook  
 * Now uses the unified polling coordinator to prevent API throttling
 */
export function useGPS51DirectPositions(
  options: UseGPS51DirectPositionsOptions = {}
): UseGPS51DirectPositionsReturn {
  const { toast } = useToast();
  const {
    autoStart = false,
    defaultDeviceIds = [],
    defaultFilter = {},
    pollingInterval = 30000,
    onPositionsUpdated,
    onError
  } = options;

  // PHASE 1 FIX: Use unified data hook
  const { state: unifiedState, actions: unifiedActions } = useGPS51UnifiedData({
    enabled: autoStart,
    priority: 'high',
    onDataUpdated: (data) => {
      if (data.positions && onPositionsUpdated) {
        onPositionsUpdated(data.positions);
      }
    },
    onError
  });

  const [localState, setLocalState] = useState({
    isPolling: autoStart,
    hasNewData: false,
    filteredCount: 0,
    totalReceived: 0
  });

  // Map unified state to legacy format
  const positionState: UseGPS51DirectPositionsState = useMemo(() => ({
    positions: unifiedState.positions,
    isLoading: unifiedState.isLoading,
    isPolling: localState.isPolling,
    error: unifiedState.error,
    lastUpdated: unifiedState.lastPositionUpdate,
    hasNewData: localState.hasNewData,
    filteredCount: unifiedState.positions.length,
    totalReceived: unifiedState.positions.length,
    pollingStats: {
      interval: pollingInterval,
      consecutiveEmpty: 0,
      successRate: 100
    }
  }), [unifiedState, localState, pollingInterval]);

  const startPolling = useCallback(() => {
    setLocalState(prev => ({ ...prev, isPolling: true }));
    toast({ title: "Position Tracking Started", description: "Using unified coordinator" });
  }, [toast]);

  const stopPolling = useCallback(() => {
    setLocalState(prev => ({ ...prev, isPolling: false }));
    toast({ title: "Position Tracking Stopped", description: "Polling paused" });
  }, [toast]);

  const refreshPositions = useCallback(async () => {
    await unifiedActions.refresh('positions');
  }, [unifiedActions]);

  const getLatestPosition = useCallback((deviceId: string): GPS51Position | null => {
    return unifiedActions.getLatestPosition(deviceId);
  }, [unifiedActions]);

  const actions: UseGPS51DirectPositionsActions = {
    startPolling,
    stopPolling,
    refreshPositions,
    getPositionHistory: () => [],
    getLatestPosition,
    clearHistory: () => {},
    clearError: unifiedActions.clearError
  };

  return {
    state: positionState,
    actions,
    hasPositions: positionState.positions.length > 0,
    isEmpty: !positionState.isLoading && positionState.positions.length === 0,
    isActive: positionState.isPolling || positionState.isLoading
  };
}