import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51DirectManager } from '../services/gps51/direct';
import type { 
  GPS51Position, 
  PositionQueryResult, 
  PositionFilter 
} from '../services/gps51/direct';
import { useToast } from './use-toast';

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
  // Convenience properties
  hasPositions: boolean;
  isEmpty: boolean;
  isActive: boolean;
}

export function useGPS51DirectPositions(
  options: UseGPS51DirectPositionsOptions = {}
): UseGPS51DirectPositionsReturn {
  const { toast } = useToast();
  const {
    autoStart = false,
    defaultDeviceIds = [],
    defaultFilter = {},
    pollingInterval = 30000, // 30 seconds
    adaptivePolling = true,
    onPositionsUpdated,
    onError
  } = options;

  const [state, setState] = useState<UseGPS51DirectPositionsState>({
    positions: [],
    isLoading: false,
    isPolling: false,
    error: null,
    lastUpdated: null,
    hasNewData: false,
    filteredCount: 0,
    totalReceived: 0,
    pollingStats: {
      interval: pollingInterval,
      consecutiveEmpty: 0,
      successRate: 100
    }
  });

  const pollingTimer = useRef<NodeJS.Timeout | null>(null);
  const currentDeviceIds = useRef<string[]>(defaultDeviceIds);
  const currentFilter = useRef<PositionFilter>(defaultFilter);
  const isMounted = useRef(true);
  const requestHistory = useRef<{ success: boolean; timestamp: number }[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (pollingTimer.current) {
        clearInterval(pollingTimer.current);
      }
    };
  }, []);

  // Calculate success rate from request history
  const calculateSuccessRate = useCallback(() => {
    const recent = requestHistory.current.slice(-10); // Last 10 requests
    if (recent.length === 0) return 100;
    
    const successful = recent.filter(r => r.success).length;
    return Math.round((successful / recent.length) * 100);
  }, []);

  // Update polling stats
  const updatePollingStats = useCallback((result: PositionQueryResult, success: boolean) => {
    // Add to request history
    requestHistory.current.push({
      success,
      timestamp: Date.now()
    });

    // Keep only recent history
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    requestHistory.current = requestHistory.current.filter(r => r.timestamp > fiveMinutesAgo);

    const pollingState = gps51DirectManager.positions.getPollingState();
    const successRate = calculateSuccessRate();

    setState(prev => ({
      ...prev,
      pollingStats: {
        interval: pollingState.adaptiveInterval,
        consecutiveEmpty: pollingState.consecutiveEmptyResponses,
        successRate
      }
    }));
  }, [calculateSuccessRate]);

  // Process position result
  const processPositionResult = useCallback((result: PositionQueryResult) => {
    setState(prev => ({
      ...prev,
      positions: result.positions,
      hasNewData: result.hasNewData,
      filteredCount: result.filteredCount,
      totalReceived: result.totalReceived,
      lastUpdated: result.lastQueryTime,
      error: null
    }));

    // Trigger callback if provided
    if (onPositionsUpdated && result.positions.length > 0) {
      onPositionsUpdated(result.positions);
    }

    updatePollingStats(result, true);

    if (result.hasNewData) {
      console.log('useGPS51DirectPositions: New positions received:', {
        count: result.positions.length,
        filtered: result.filteredCount,
        total: result.totalReceived
      });
    }

    return result;
  }, [onPositionsUpdated, updatePollingStats]);

  // Fetch positions
  const fetchPositions = useCallback(async (
    deviceIds: string[] = currentDeviceIds.current,
    filter: PositionFilter = currentFilter.current
  ): Promise<void> => {
    if (!gps51DirectManager.auth.isAuthenticated()) {
      const error = 'Not authenticated. Please login first.';
      setState(prev => ({ ...prev, error }));
      if (onError) onError(error);
      return;
    }

    try {
      console.log('useGPS51DirectPositions: Fetching positions...', {
        deviceCount: deviceIds.length,
        filter
      });

      const result = await gps51DirectManager.positions.getRealtimePositions(deviceIds, filter);
      
      if (!isMounted.current) return;

      processPositionResult(result);

    } catch (error) {
      if (!isMounted.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
      console.error('useGPS51DirectPositions: Error fetching positions:', errorMessage);

      setState(prev => ({ ...prev, error: errorMessage }));
      updatePollingStats({ positions: [], hasNewData: false } as PositionQueryResult, false);

      if (onError) {
        onError(errorMessage);
      }

      // Don't show toast for every polling error to avoid spam
      if (!state.isPolling) {
        toast({
          title: "Error Loading Positions",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  }, [state.isPolling, onError, toast, processPositionResult, updatePollingStats]);

  // Start polling
  const startPolling = useCallback((
    deviceIds: string[] = defaultDeviceIds,
    filter: PositionFilter = defaultFilter
  ) => {
    console.log('useGPS51DirectPositions: Starting polling...', {
      deviceCount: deviceIds.length,
      interval: pollingInterval,
      adaptivePolling
    });

    // Update current parameters
    currentDeviceIds.current = deviceIds;
    currentFilter.current = filter;

    setState(prev => ({ 
      ...prev, 
      isPolling: true, 
      isLoading: true,
      error: null 
    }));

    // Initial fetch
    fetchPositions(deviceIds, filter).finally(() => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Start polling timer
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
    }

    pollingTimer.current = setInterval(() => {
      if (gps51DirectManager.auth.isAuthenticated()) {
        // Use adaptive interval if enabled
        const pollingState = gps51DirectManager.positions.getPollingState();
        const currentInterval = adaptivePolling ? pollingState.adaptiveInterval : pollingInterval;
        
        // Reset timer with new interval if it changed
        if (adaptivePolling && currentInterval !== pollingInterval) {
          clearInterval(pollingTimer.current!);
          pollingTimer.current = setInterval(() => {
            fetchPositions(currentDeviceIds.current, currentFilter.current);
          }, currentInterval);
        }
        
        fetchPositions(currentDeviceIds.current, currentFilter.current);
      }
    }, adaptivePolling ? pollingInterval : pollingInterval);

    toast({
      title: "Position Tracking Started",
      description: `Monitoring ${deviceIds.length} devices`,
    });
  }, [defaultDeviceIds, defaultFilter, pollingInterval, adaptivePolling, fetchPositions, toast]);

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('useGPS51DirectPositions: Stopping polling...');

    setState(prev => ({ ...prev, isPolling: false }));

    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
    }

    toast({
      title: "Position Tracking Stopped",
      description: "Live position updates paused",
    });
  }, [toast]);

  // Refresh positions manually
  const refreshPositions = useCallback(async (
    deviceIds?: string[],
    filter?: PositionFilter
  ): Promise<void> => {
    const targetDeviceIds = deviceIds || currentDeviceIds.current;
    const targetFilter = filter || currentFilter.current;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await fetchPositions(targetDeviceIds, targetFilter);
    } finally {
      if (isMounted.current) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [fetchPositions]);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart && gps51DirectManager.auth.isAuthenticated() && !state.isPolling) {
      startPolling(defaultDeviceIds, defaultFilter);
    }
  }, [autoStart, defaultDeviceIds, defaultFilter, startPolling, state.isPolling]);

  // Position history methods
  const getPositionHistory = useCallback((deviceId: string, limit = 10): GPS51Position[] => {
    return gps51DirectManager.positions.getPositionHistory(deviceId, limit);
  }, []);

  const getLatestPosition = useCallback((deviceId: string): GPS51Position | null => {
    return gps51DirectManager.positions.getLatestPosition(deviceId);
  }, []);

  const clearHistory = useCallback(() => {
    gps51DirectManager.positions.clearHistory();
    toast({
      title: "History Cleared",
      description: "Position history has been cleared",
    });
  }, [toast]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: UseGPS51DirectPositionsActions = {
    startPolling,
    stopPolling,
    refreshPositions,
    getPositionHistory,
    getLatestPosition,
    clearHistory,
    clearError
  };

  const hasPositions = state.positions.length > 0;
  const isEmpty = !state.isLoading && state.positions.length === 0;
  const isActive = state.isPolling || state.isLoading;

  return {
    state,
    actions,
    hasPositions,
    isEmpty,
    isActive
  };
}
