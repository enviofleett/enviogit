import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GPS51OptimizedApiClient } from '@/services/gps51/GPS51OptimizedApiClient';
import { gps51ErrorHandler } from '@/services/gps51/GPS51CentralizedErrorHandler';

interface PerformanceMetrics {
  requestLatency: number[];
  cacheHitRate: number;
  errorRate: number;
  throughput: number;
  concurrentRequests: number;
  memoryUsage: number;
}

interface PredictiveCache {
  predictions: Map<string, { timestamp: number; confidence: number }>;
  hitPatterns: Map<string, number[]>;
  userBehavior: {
    mostAccessedDevices: string[];
    commonTimeRanges: string[];
    refreshPatterns: number[];
  };
}

interface RequestDeduplication {
  pendingRequests: Map<string, Promise<any>>;
  requestHashes: Map<string, number>;
}

export function useGPS51Performance(client: GPS51OptimizedApiClient) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    requestLatency: [],
    cacheHitRate: 0,
    errorRate: 0,
    throughput: 0,
    concurrentRequests: 0,
    memoryUsage: 0
  });

  const predictiveCache = useRef<PredictiveCache>({
    predictions: new Map(),
    hitPatterns: new Map(),
    userBehavior: {
      mostAccessedDevices: [],
      commonTimeRanges: [],
      refreshPatterns: []
    }
  });

  const requestDeduplication = useRef<RequestDeduplication>({
    pendingRequests: new Map(),
    requestHashes: new Map()
  });

  const performanceTimer = useRef<NodeJS.Timeout | null>(null);
  const memoryObserver = useRef<PerformanceObserver | null>(null);

  // Memoized performance tracking functions
  const trackRequest = useCallback((
    requestType: string,
    duration: number,
    success: boolean,
    cacheHit: boolean = false
  ) => {
    setMetrics(prev => {
      const newLatencies = [...prev.requestLatency, duration].slice(-100); // Keep last 100
      const avgLatency = newLatencies.reduce((sum, lat) => sum + lat, 0) / newLatencies.length;
      
      return {
        ...prev,
        requestLatency: newLatencies,
        cacheHitRate: cacheHit ? Math.min(prev.cacheHitRate + 1, 100) : prev.cacheHitRate * 0.99,
        errorRate: success ? prev.errorRate * 0.99 : Math.min(prev.errorRate + 1, 100),
        throughput: calculateThroughput(newLatencies)
      };
    });

    // Update predictive cache patterns
    updateCachePatterns(requestType, duration, cacheHit);
  }, []);

  const updateCachePatterns = useCallback((
    requestType: string,
    duration: number,
    cacheHit: boolean
  ) => {
    const cache = predictiveCache.current;
    const patterns = cache.hitPatterns.get(requestType) || [];
    
    patterns.push(cacheHit ? 1 : 0);
    if (patterns.length > 50) patterns.shift(); // Keep last 50 patterns
    
    cache.hitPatterns.set(requestType, patterns);
    
    // Update predictions based on patterns
    const hitRate = patterns.reduce((sum, hit) => sum + hit, 0) / patterns.length;
    cache.predictions.set(requestType, {
      timestamp: Date.now(),
      confidence: hitRate
    });
  }, []);

  const calculateThroughput = useCallback((latencies: number[]): number => {
    if (latencies.length === 0) return 0;
    
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    return avgLatency > 0 ? 1000 / avgLatency : 0; // Requests per second
  }, []);

  // Request deduplication wrapper
  const deduplicateRequest = useCallback(async <T>(
    requestKey: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    const dedup = requestDeduplication.current;
    
    // Check if request is already pending
    if (dedup.pendingRequests.has(requestKey)) {
      console.log(`GPS51Performance: Deduplicating request ${requestKey}`);
      return dedup.pendingRequests.get(requestKey) as Promise<T>;
    }

    // Create new request
    const promise = (async () => {
      const startTime = Date.now();
      let success = false;
      let cacheHit = false;

      try {
        setMetrics(prev => ({ ...prev, concurrentRequests: prev.concurrentRequests + 1 }));
        
        const result = await requestFn();
        success = true;
        
        // Check if result came from cache (simplified heuristic)
        const duration = Date.now() - startTime;
        cacheHit = duration < 100; // Likely cache hit if very fast
        
        trackRequest(requestKey, duration, success, cacheHit);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        trackRequest(requestKey, duration, false, false);
        
        // Handle error through centralized handler
        gps51ErrorHandler.handleError(
          error instanceof Error ? error : new Error('Request failed'),
          { requestKey, duration }
        );
        
        throw error;
      } finally {
        setMetrics(prev => ({ ...prev, concurrentRequests: Math.max(0, prev.concurrentRequests - 1) }));
        dedup.pendingRequests.delete(requestKey);
      }
    })();

    dedup.pendingRequests.set(requestKey, promise);
    return promise;
  }, [trackRequest]);

  // Predictive caching
  const shouldPreload = useCallback((requestType: string): boolean => {
    const cache = predictiveCache.current;
    const prediction = cache.predictions.get(requestType);
    
    if (!prediction) return false;
    
    // Preload if high confidence and recent pattern
    const age = Date.now() - prediction.timestamp;
    const isRecent = age < 60000; // 1 minute
    const isHighConfidence = prediction.confidence > 0.7;
    
    return isRecent && isHighConfidence;
  }, []);

  const preloadLikelyRequests = useCallback(async () => {
    const cache = predictiveCache.current;
    const deviceIds = cache.userBehavior.mostAccessedDevices.slice(0, 5); // Top 5 devices
    
    if (deviceIds.length === 0) return;

    console.log('GPS51Performance: Preloading likely requests for devices:', deviceIds);
    
    try {
      // Preload positions for most accessed devices
      if (shouldPreload('positions')) {
        await deduplicateRequest(
          `preload_positions_${deviceIds.join(',')}`,
          () => client.getLastPosition(deviceIds, 0, true)
        );
      }
    } catch (error) {
      console.warn('GPS51Performance: Preload failed:', error);
    }
  }, [client, shouldPreload, deduplicateRequest]);

  // Memory usage tracking
  const trackMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usagePercentage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
      
      setMetrics(prev => ({ ...prev, memoryUsage: usagePercentage }));
      
      // Trigger garbage collection hint if memory usage is high
      if (usagePercentage > 80) {
        console.warn('GPS51Performance: High memory usage detected:', usagePercentage.toFixed(1) + '%');
        
        // Clear old cache entries
        if (usagePercentage > 90) {
          client.clearCache();
        }
      }
    }
  }, [client]);

  // Performance monitoring setup
  useEffect(() => {
    // Set up performance monitoring
    performanceTimer.current = setInterval(() => {
      trackMemoryUsage();
      
      // Update client metrics
      const clientMetrics = client.getMetrics();
      setMetrics(prev => ({
        ...prev,
        cacheHitRate: clientMetrics.cacheHitRate,
        errorRate: 100 - clientMetrics.successRate
      }));
    }, 5000); // Every 5 seconds

    // Set up memory observer if available
    if ('PerformanceObserver' in window) {
      try {
        memoryObserver.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              trackRequest(entry.name, entry.duration, true);
            }
          });
        });
        
        memoryObserver.current.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('GPS51Performance: Performance observer not supported');
      }
    }

    return () => {
      if (performanceTimer.current) {
        clearInterval(performanceTimer.current);
      }
      if (memoryObserver.current) {
        memoryObserver.current.disconnect();
      }
    };
  }, [client, trackMemoryUsage, trackRequest]);

  // Predictive preloading effect
  useEffect(() => {
    const preloadInterval = setInterval(() => {
      preloadLikelyRequests();
    }, 30000); // Every 30 seconds

    return () => clearInterval(preloadInterval);
  }, [preloadLikelyRequests]);

  // Update user behavior patterns
  const updateUserBehavior = useCallback((
    deviceIds: string[],
    timeRange?: string,
    refreshInterval?: number
  ) => {
    const behavior = predictiveCache.current.userBehavior;
    
    // Track most accessed devices
    deviceIds.forEach(deviceId => {
      const index = behavior.mostAccessedDevices.indexOf(deviceId);
      if (index > -1) {
        // Move to front (most recent access)
        behavior.mostAccessedDevices.splice(index, 1);
      }
      behavior.mostAccessedDevices.unshift(deviceId);
    });
    
    // Keep only top 20 devices
    behavior.mostAccessedDevices = behavior.mostAccessedDevices.slice(0, 20);
    
    // Track time ranges
    if (timeRange) {
      if (!behavior.commonTimeRanges.includes(timeRange)) {
        behavior.commonTimeRanges.push(timeRange);
        if (behavior.commonTimeRanges.length > 10) {
          behavior.commonTimeRanges.shift();
        }
      }
    }
    
    // Track refresh patterns
    if (refreshInterval) {
      behavior.refreshPatterns.push(refreshInterval);
      if (behavior.refreshPatterns.length > 20) {
        behavior.refreshPatterns.shift();
      }
    }
  }, []);

  // Optimized request methods with performance tracking
  const optimizedGetPositions = useCallback(async (
    deviceIds: string[],
    useCache: boolean = true
  ) => {
    const requestKey = `positions_${deviceIds.join(',')}_${useCache}`;
    
    updateUserBehavior(deviceIds);
    
    return deduplicateRequest(requestKey, () => 
      client.getLastPosition(deviceIds, 0, useCache)
    );
  }, [client, deduplicateRequest, updateUserBehavior]);

  const optimizedGetDevices = useCallback(async (
    username: string,
    useCache: boolean = true
  ) => {
    const requestKey = `devices_${username}_${useCache}`;
    
    return deduplicateRequest(requestKey, () =>
      client.getDeviceList(username, useCache)
    );
  }, [client, deduplicateRequest]);

  const optimizedGetHistory = useCallback(async (
    deviceId: string,
    beginTime: string,
    endTime: string,
    timezone: number = 8
  ) => {
    const requestKey = `history_${deviceId}_${beginTime}_${endTime}_${timezone}`;
    const timeRange = `${beginTime}_${endTime}`;
    
    updateUserBehavior([deviceId], timeRange);
    
    return deduplicateRequest(requestKey, () =>
      client.getHistoryTracks(deviceId, beginTime, endTime, timezone)
    );
  }, [client, deduplicateRequest, updateUserBehavior]);

  // Performance insights
  const performanceInsights = useMemo(() => {
    const avgLatency = metrics.requestLatency.length > 0 
      ? metrics.requestLatency.reduce((sum, lat) => sum + lat, 0) / metrics.requestLatency.length
      : 0;

    return {
      isHealthy: metrics.errorRate < 5 && avgLatency < 2000,
      recommendations: [
        metrics.cacheHitRate < 50 ? 'Consider enabling more aggressive caching' : null,
        metrics.errorRate > 10 ? 'High error rate detected - check network connectivity' : null,
        avgLatency > 3000 ? 'High latency detected - consider optimizing requests' : null,
        metrics.memoryUsage > 80 ? 'High memory usage - consider clearing cache' : null
      ].filter(Boolean),
      score: Math.max(0, 100 - metrics.errorRate - (avgLatency / 100) + metrics.cacheHitRate / 2)
    };
  }, [metrics]);

  return {
    metrics,
    performanceInsights,
    optimizedRequests: {
      getPositions: optimizedGetPositions,
      getDevices: optimizedGetDevices,
      getHistory: optimizedGetHistory
    },
    utils: {
      trackRequest,
      shouldPreload,
      updateUserBehavior,
      clearCache: client.clearCache.bind(client),
      getPredictions: () => Object.fromEntries(predictiveCache.current.predictions),
      getUserBehavior: () => ({ ...predictiveCache.current.userBehavior })
    }
  };
}
