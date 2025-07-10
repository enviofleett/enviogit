import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBackgroundRefreshOptions {
  refreshInterval?: number; // in milliseconds
  enabled?: boolean;
  onError?: (error: Error) => void;
  dependencies?: any[];
}

interface BackgroundRefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  error: Error | null;
}

export function useBackgroundRefresh<T>(
  refreshFunction: () => Promise<T>,
  options: UseBackgroundRefreshOptions = {}
) {
  const {
    refreshInterval = 30000, // 30 seconds default
    enabled = true,
    onError,
    dependencies = []
  } = options;

  const [state, setState] = useState<BackgroundRefreshState>({
    isRefreshing: false,
    lastRefresh: null,
    error: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const performRefresh = useCallback(async (showLoading = false) => {
    if (!isActiveRef.current) return;

    try {
      if (showLoading) {
        setState(prev => ({ ...prev, isRefreshing: true, error: null }));
      }

      await refreshFunction();
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        lastRefresh: new Date(),
        error: null
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: err
      }));
      
      if (onError) {
        onError(err);
      }
    }
  }, [refreshFunction, onError]);

  const manualRefresh = useCallback(() => {
    performRefresh(true);
  }, [performRefresh]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (enabled && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        performRefresh(false); // Background refresh without loading state
      }, refreshInterval);
    }
  }, [enabled, refreshInterval, performRefresh]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility change - pause when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        startInterval();
        // Refresh immediately when tab becomes visible
        performRefresh(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [startInterval, stopInterval, performRefresh]);

  // Start/stop interval based on enabled state
  useEffect(() => {
    if (enabled) {
      startInterval();
    } else {
      stopInterval();
    }

    return stopInterval;
  }, [enabled, startInterval, stopInterval]);

  // Restart interval when dependencies change
  useEffect(() => {
    if (enabled) {
      startInterval();
    }
  }, dependencies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      stopInterval();
    };
  }, [stopInterval]);

  return {
    ...state,
    manualRefresh,
    startInterval,
    stopInterval
  };
}