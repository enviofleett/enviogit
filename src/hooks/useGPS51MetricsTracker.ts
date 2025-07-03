import { useState, useEffect, useCallback, useRef } from 'react';
import { useGPS51DirectAuth } from './useGPS51DirectAuth';
import { useGPS51DirectVehicles } from './useGPS51DirectVehicles';
import { useGPS51DirectPositions } from './useGPS51DirectPositions';
import { useGPS51DirectConnection } from './useGPS51DirectConnection';

export interface MetricsConfig {
  enableDetailedMetrics: boolean;
  metricsRetention: number; // hours
  performanceThresholds: {
    responseTime: number; // ms
    successRate: number;  // percentage
    memoryUsage: number;  // MB
  };
  alertThresholds: {
    criticalResponseTime: number;
    criticalSuccessRate: number;
    criticalErrorRate: number;
  };
}

export interface PerformanceMetric {
  timestamp: number;
  category: 'auth' | 'vehicles' | 'positions' | 'connection' | 'general';
  action: string;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface UsageMetric {
  timestamp: number;
  event: string;
  userId?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface SystemMetric {
  timestamp: number;
  memoryUsage: number;
  activeConnections: number;
  cacheSize: number;
  errorCount: number;
}

export interface MetricsSnapshot {
  performance: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
    errorRate: number;
    slowestOperations: Array<{ action: string; avgDuration: number }>;
  };
  usage: {
    activeUsers: number;
    sessionsToday: number;
    popularFeatures: Array<{ feature: string; usage: number }>;
    peakUsageTime: string;
  };
  system: {
    memoryUsage: number;
    cacheEfficiency: number;
    connectionHealth: number;
    uptime: number;
  };
  alerts: Array<{
    type: 'warning' | 'critical';
    message: string;
    timestamp: number;
    resolved: boolean;
  }>;
}

export interface UseGPS51MetricsTrackerReturn {
  // Metrics collection
  trackPerformance: (category: PerformanceMetric['category'], action: string, startTime: number, success: boolean, error?: string, metadata?: Record<string, any>) => void;
  trackUsage: (event: string, metadata?: Record<string, any>) => void;
  trackSystemMetric: (memoryUsage: number, activeConnections: number, cacheSize: number, errorCount: number) => void;
  
  // Metrics retrieval
  getSnapshot: () => MetricsSnapshot;
  getPerformanceMetrics: (category?: PerformanceMetric['category'], hours?: number) => PerformanceMetric[];
  getUsageMetrics: (hours?: number) => UsageMetric[];
  getSystemMetrics: (hours?: number) => SystemMetric[];
  
  // Analysis
  analyzePerformance: () => {
    trends: Array<{ metric: string; trend: 'improving' | 'degrading' | 'stable'; percentage: number }>;
    bottlenecks: Array<{ category: string; avgDuration: number; count: number }>;
    recommendations: string[];
  };
  
  // Configuration
  updateConfig: (config: Partial<MetricsConfig>) => void;
  
  // Maintenance
  cleanup: () => number;
  export: () => string;
  clear: () => void;
}

const DEFAULT_CONFIG: MetricsConfig = {
  enableDetailedMetrics: true,
  metricsRetention: 24, // 24 hours
  performanceThresholds: {
    responseTime: 5000, // 5 seconds
    successRate: 95,    // 95%
    memoryUsage: 100    // 100MB
  },
  alertThresholds: {
    criticalResponseTime: 10000, // 10 seconds
    criticalSuccessRate: 80,     // 80%
    criticalErrorRate: 20        // 20%
  }
};

export function useGPS51MetricsTracker(
  initialConfig: Partial<MetricsConfig> = {}
): UseGPS51MetricsTrackerReturn {
  const [config, setConfig] = useState<MetricsConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });

  const performanceMetrics = useRef<PerformanceMetric[]>([]);
  const usageMetrics = useRef<UsageMetric[]>([]);
  const systemMetrics = useRef<SystemMetric[]>([]);
  const sessionId = useRef<string>(Math.random().toString(36).substr(2, 9));
  const startTime = useRef<number>(Date.now());

  // Hooks for automatic tracking
  const auth = useGPS51DirectAuth();
  const vehicles = useGPS51DirectVehicles({ autoRefresh: false });
  const positions = useGPS51DirectPositions({ autoStart: false });
  const connection = useGPS51DirectConnection({ autoStart: false });

  // Cleanup timer
  const cleanupTimer = useRef<NodeJS.Timeout | null>(null);

  // Automatic cleanup every hour
  useEffect(() => {
    cleanupTimer.current = setInterval(() => {
      cleanup();
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      if (cleanupTimer.current) {
        clearInterval(cleanupTimer.current);
      }
    };
  }, []);

  // Track performance metric
  const trackPerformance = useCallback((
    category: PerformanceMetric['category'],
    action: string,
    startTime: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ) => {
    if (!config.enableDetailedMetrics) return;

    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      category,
      action,
      duration: Date.now() - startTime,
      success,
      error,
      metadata
    };

    performanceMetrics.current.push(metric);

    // Log slow operations
    if (metric.duration > config.performanceThresholds.responseTime) {
      console.warn('GPS51 Metrics: Slow operation detected:', {
        category,
        action,
        duration: metric.duration,
        success
      });
    }

    console.log('GPS51 Metrics: Performance tracked:', {
      category,
      action,
      duration: metric.duration,
      success
    });
  }, [config.enableDetailedMetrics, config.performanceThresholds.responseTime]);

  // Track usage metric
  const trackUsage = useCallback((event: string, metadata?: Record<string, any>) => {
    if (!config.enableDetailedMetrics) return;

    const metric: UsageMetric = {
      timestamp: Date.now(),
      event,
      sessionId: sessionId.current,
      metadata
    };

    usageMetrics.current.push(metric);

    console.log('GPS51 Metrics: Usage tracked:', { event, metadata });
  }, [config.enableDetailedMetrics]);

  // Track system metric
  const trackSystemMetric = useCallback((
    memoryUsage: number,
    activeConnections: number,
    cacheSize: number,
    errorCount: number
  ) => {
    const metric: SystemMetric = {
      timestamp: Date.now(),
      memoryUsage,
      activeConnections,
      cacheSize,
      errorCount
    };

    systemMetrics.current.push(metric);

    // Check for memory usage alerts
    if (memoryUsage > config.performanceThresholds.memoryUsage) {
      console.warn('GPS51 Metrics: High memory usage:', memoryUsage + 'MB');
    }
  }, [config.performanceThresholds.memoryUsage]);

  // Get metrics snapshot
  const getSnapshot = useCallback((): MetricsSnapshot => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Performance metrics (last hour)
    const recentPerformance = performanceMetrics.current.filter(m => m.timestamp > oneHourAgo);
    const totalRequests = recentPerformance.length;
    const successfulRequests = recentPerformance.filter(m => m.success).length;
    const averageResponseTime = totalRequests > 0 
      ? recentPerformance.reduce((sum, m) => sum + m.duration, 0) / totalRequests
      : 0;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
    const errorRate = totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0;

    // Slowest operations
    const operationStats = new Map<string, { total: number; count: number }>();
    recentPerformance.forEach(m => {
      const key = `${m.category}:${m.action}`;
      const existing = operationStats.get(key) || { total: 0, count: 0 };
      operationStats.set(key, {
        total: existing.total + m.duration,
        count: existing.count + 1
      });
    });

    const slowestOperations = Array.from(operationStats.entries())
      .map(([action, stats]) => ({
        action,
        avgDuration: stats.total / stats.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    // Usage metrics (last day)
    const recentUsage = usageMetrics.current.filter(m => m.timestamp > oneDayAgo);
    const uniqueSessions = new Set(recentUsage.map(m => m.sessionId)).size;
    const featureUsage = new Map<string, number>();
    
    recentUsage.forEach(m => {
      featureUsage.set(m.event, (featureUsage.get(m.event) || 0) + 1);
    });

    const popularFeatures = Array.from(featureUsage.entries())
      .map(([feature, usage]) => ({ feature, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);

    // System metrics
    const recentSystem = systemMetrics.current.filter(m => m.timestamp > oneHourAgo);
    const latestSystem = recentSystem[recentSystem.length - 1];
    
    const uptime = now - startTime.current;

    // Generate alerts
    const alerts: MetricsSnapshot['alerts'] = [];
    
    if (averageResponseTime > config.alertThresholds.criticalResponseTime) {
      alerts.push({
        type: 'critical',
        message: `High response time: ${Math.round(averageResponseTime)}ms`,
        timestamp: now,
        resolved: false
      });
    }

    if (successRate < config.alertThresholds.criticalSuccessRate) {
      alerts.push({
        type: 'critical',
        message: `Low success rate: ${Math.round(successRate)}%`,
        timestamp: now,
        resolved: false
      });
    }

    if (errorRate > config.alertThresholds.criticalErrorRate) {
      alerts.push({
        type: 'critical',
        message: `High error rate: ${Math.round(errorRate)}%`,
        timestamp: now,
        resolved: false
      });
    }

    return {
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        successRate: Math.round(successRate * 100) / 100,
        totalRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        slowestOperations
      },
      usage: {
        activeUsers: 1, // Single user for now
        sessionsToday: uniqueSessions,
        popularFeatures,
        peakUsageTime: 'N/A' // Would need hourly analysis
      },
      system: {
        memoryUsage: latestSystem?.memoryUsage || 0,
        cacheEfficiency: 85, // Placeholder
        connectionHealth: connection.isConnected ? 100 : 0,
        uptime
      },
      alerts
    };
  }, [config.alertThresholds, connection.isConnected]);

  // Get filtered performance metrics
  const getPerformanceMetrics = useCallback((
    category?: PerformanceMetric['category'],
    hours = 1
  ): PerformanceMetric[] => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return performanceMetrics.current.filter(m => 
      m.timestamp > cutoff && 
      (!category || m.category === category)
    );
  }, []);

  // Get filtered usage metrics
  const getUsageMetrics = useCallback((hours = 1): UsageMetric[] => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return usageMetrics.current.filter(m => m.timestamp > cutoff);
  }, []);

  // Get filtered system metrics
  const getSystemMetrics = useCallback((hours = 1): SystemMetric[] => {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return systemMetrics.current.filter(m => m.timestamp > cutoff);
  }, []);

  // Analyze performance trends
  const analyzePerformance = useCallback(() => {
    const recent = getPerformanceMetrics(undefined, 1);
    const previous = getPerformanceMetrics(undefined, 2).filter(m => 
      m.timestamp < Date.now() - (60 * 60 * 1000)
    );

    const trends: Array<{ metric: string; trend: 'improving' | 'degrading' | 'stable'; percentage: number }> = [];
    const bottlenecks: Array<{ category: string; avgDuration: number; count: number }> = [];
    const recommendations: string[] = [];

    // Response time trend
    const recentAvg = recent.length > 0 
      ? recent.reduce((sum, m) => sum + m.duration, 0) / recent.length 
      : 0;
    const previousAvg = previous.length > 0 
      ? previous.reduce((sum, m) => sum + m.duration, 0) / previous.length 
      : 0;

    if (previousAvg > 0) {
      const change = ((recentAvg - previousAvg) / previousAvg) * 100;
      trends.push({
        metric: 'Response Time',
        trend: change < -5 ? 'improving' : change > 5 ? 'degrading' : 'stable',
        percentage: Math.abs(change)
      });
    }

    // Success rate trend
    const recentSuccess = recent.length > 0 
      ? (recent.filter(m => m.success).length / recent.length) * 100
      : 100;
    const previousSuccess = previous.length > 0 
      ? (previous.filter(m => m.success).length / previous.length) * 100
      : 100;

    const successChange = recentSuccess - previousSuccess;
    trends.push({
      metric: 'Success Rate',
      trend: successChange > 5 ? 'improving' : successChange < -5 ? 'degrading' : 'stable',
      percentage: Math.abs(successChange)
    });

    // Identify bottlenecks
    const categoryStats = new Map<string, { total: number; count: number }>();
    recent.forEach(m => {
      const existing = categoryStats.get(m.category) || { total: 0, count: 0 };
      categoryStats.set(m.category, {
        total: existing.total + m.duration,
        count: existing.count + 1
      });
    });

    categoryStats.forEach((stats, category) => {
      const avgDuration = stats.total / stats.count;
      if (avgDuration > config.performanceThresholds.responseTime) {
        bottlenecks.push({ category, avgDuration, count: stats.count });
      }
    });

    // Generate recommendations
    if (recentAvg > config.performanceThresholds.responseTime) {
      recommendations.push('Consider implementing caching to improve response times');
    }
    
    if (recentSuccess < config.performanceThresholds.successRate) {
      recommendations.push('Investigate error patterns and implement better error handling');
    }

    if (bottlenecks.length > 0) {
      recommendations.push(`Focus optimization efforts on: ${bottlenecks.map(b => b.category).join(', ')}`);
    }

    return { trends, bottlenecks, recommendations };
  }, [getPerformanceMetrics, config.performanceThresholds]);

  // Clean up old metrics
  const cleanup = useCallback((): number => {
    const cutoff = Date.now() - (config.metricsRetention * 60 * 60 * 1000);
    
    const perfBefore = performanceMetrics.current.length;
    const usageBefore = usageMetrics.current.length;
    const systemBefore = systemMetrics.current.length;

    performanceMetrics.current = performanceMetrics.current.filter(m => m.timestamp > cutoff);
    usageMetrics.current = usageMetrics.current.filter(m => m.timestamp > cutoff);
    systemMetrics.current = systemMetrics.current.filter(m => m.timestamp > cutoff);

    const totalRemoved = (perfBefore - performanceMetrics.current.length) +
                        (usageBefore - usageMetrics.current.length) +
                        (systemBefore - systemMetrics.current.length);

    if (totalRemoved > 0) {
      console.log('GPS51 Metrics: Cleaned up', totalRemoved, 'old metrics');
    }

    return totalRemoved;
  }, [config.metricsRetention]);

  // Export metrics
  const exportMetrics = useCallback((): string => {
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      sessionId: sessionId.current,
      config,
      performance: performanceMetrics.current,
      usage: usageMetrics.current,
      system: systemMetrics.current
    });
  }, [config]);

  // Clear all metrics
  const clear = useCallback(() => {
    performanceMetrics.current = [];
    usageMetrics.current = [];
    systemMetrics.current = [];
    console.log('GPS51 Metrics: All metrics cleared');
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<MetricsConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('GPS51 Metrics: Config updated', newConfig);
  }, []);

  // Auto-track auth events
  useEffect(() => {
    if (auth.state.isAuthenticated) {
      trackUsage('auth:login');
    }
  }, [auth.state.isAuthenticated, trackUsage]);

  // Auto-track vehicle updates
  useEffect(() => {
    if (vehicles.hasVehicles) {
      trackUsage('vehicles:loaded', { count: vehicles.state.vehicles.length });
    }
  }, [vehicles.hasVehicles, vehicles.state.vehicles.length, trackUsage]);

  // Auto-track position updates
  useEffect(() => {
    if (positions.hasPositions) {
      trackUsage('positions:received', { count: positions.state.positions.length });
    }
  }, [positions.hasPositions, positions.state.positions.length, trackUsage]);

  return {
    trackPerformance,
    trackUsage,
    trackSystemMetric,
    getSnapshot,
    getPerformanceMetrics,
    getUsageMetrics,
    getSystemMetrics,
    analyzePerformance,
    updateConfig,
    cleanup,
    export: exportMetrics,
    clear
  };
}