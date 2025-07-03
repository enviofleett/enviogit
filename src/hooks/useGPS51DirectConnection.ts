import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51DirectManager } from '../services/gps51/direct';
import { useToast } from './use-toast';

export interface UseGPS51DirectConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'degraded';
  isHealthy: boolean;
  latency: number;
  lastCheck: number;
  uptime: number;
  errorCount: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
    activeRequests: number;
    recentErrors: string[];
  };
}

export interface UseGPS51DirectConnectionActions {
  testConnection: () => Promise<void>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  resetMetrics: () => void;
  forceReconnect: () => Promise<void>;
}

export interface UseGPS51DirectConnectionOptions {
  autoStart?: boolean;
  checkInterval?: number;
  healthThreshold?: number; // ms
  alertOnFailure?: boolean;
  onStatusChange?: (status: UseGPS51DirectConnectionState['status']) => void;
  onHealthChange?: (isHealthy: boolean) => void;
}

export interface UseGPS51DirectConnectionReturn {
  state: UseGPS51DirectConnectionState;
  actions: UseGPS51DirectConnectionActions;
  // Convenience properties
  isConnected: boolean;
  hasErrors: boolean;
  needsAttention: boolean;
}

export function useGPS51DirectConnection(
  options: UseGPS51DirectConnectionOptions = {}
): UseGPS51DirectConnectionReturn {
  const { toast } = useToast();
  const {
    autoStart = true,
    checkInterval = 60000, // 1 minute
    healthThreshold = 5000, // 5 seconds
    alertOnFailure = true,
    onStatusChange,
    onHealthChange
  } = options;

  const [state, setState] = useState<UseGPS51DirectConnectionState>({
    status: 'disconnected',
    isHealthy: false,
    latency: 0,
    lastCheck: 0,
    uptime: 0,
    errorCount: 0,
    quality: 'poor',
    metrics: {
      averageResponseTime: 0,
      successRate: 0,
      totalRequests: 0,
      activeRequests: 0,
      recentErrors: []
    }
  });

  const monitoringTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(Date.now());
  const healthHistory = useRef<{ timestamp: number; latency: number; success: boolean }[]>([]);
  const isMounted = useRef(true);
  const lastStatus = useRef<UseGPS51DirectConnectionState['status']>('disconnected');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (monitoringTimer.current) {
        clearInterval(monitoringTimer.current);
      }
    };
  }, []);

  // Calculate connection quality based on metrics
  const calculateQuality = useCallback((latency: number, successRate: number): UseGPS51DirectConnectionState['quality'] => {
    if (successRate < 50 || latency > 10000) return 'poor';
    if (successRate < 80 || latency > 5000) return 'fair';
    if (successRate < 95 || latency > 2000) return 'good';
    return 'excellent';
  }, []);

  // Update metrics from API client
  const updateMetrics = useCallback(() => {
    // For now, use local metrics until we expose API client metrics
    
    // Calculate uptime
    const uptime = Date.now() - startTime.current;
    
    // Get recent health data (last 10 checks)
    const recentHealth = healthHistory.current.slice(-10);
    const successRate = recentHealth.length > 0 
      ? (recentHealth.filter(h => h.success).length / recentHealth.length) * 100
      : 0;
    
    const averageLatency = recentHealth.length > 0
      ? recentHealth.reduce((sum, h) => sum + h.latency, 0) / recentHealth.length
      : 0;

    const quality = calculateQuality(averageLatency, successRate);

    setState(prev => ({
      ...prev,
      uptime,
      quality,
      metrics: {
        averageResponseTime: Math.round(averageLatency),
        successRate: Math.round(successRate),
        totalRequests: recentHealth.length,
        activeRequests: 0,
        recentErrors: []
      }
    }));
  }, [calculateQuality]);

  // Test connection health
  const testConnection = useCallback(async (): Promise<void> => {
    if (!gps51DirectManager.auth.isAuthenticated()) {
      setState(prev => ({
        ...prev,
        status: 'disconnected',
        isHealthy: false,
        lastCheck: Date.now()
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      status: prev.status === 'disconnected' ? 'connecting' : prev.status
    }));

    try {
      console.log('useGPS51DirectConnection: Testing connection...');
      
      const healthResult = await gps51DirectManager.auth.testConnection();
      const now = Date.now();
      
      if (!isMounted.current) return;

      // Add to health history
      healthHistory.current.push({
        timestamp: now,
        latency: healthResult.latency || 0,
        success: healthResult.success
      });

      // Keep only recent history (last 50 checks)
      if (healthHistory.current.length > 50) {
        healthHistory.current = healthHistory.current.slice(-50);
      }

      const isHealthy = healthResult.success && (healthResult.latency || 0) < healthThreshold;
      const newStatus: UseGPS51DirectConnectionState['status'] = healthResult.success 
        ? (isHealthy ? 'connected' : 'degraded')
        : 'error';

      setState(prev => ({
        ...prev,
        status: newStatus,
        isHealthy,
        latency: healthResult.latency || 0,
        lastCheck: now,
        errorCount: healthResult.success ? 0 : prev.errorCount + 1
      }));

      // Trigger status change callback
      if (newStatus !== lastStatus.current) {
        lastStatus.current = newStatus;
        if (onStatusChange) {
          onStatusChange(newStatus);
        }
      }

      // Trigger health change callback
      if (isHealthy !== state.isHealthy && onHealthChange) {
        onHealthChange(isHealthy);
      }

      // Update metrics
      updateMetrics();

      // Alert on significant changes
      if (alertOnFailure && !healthResult.success && state.status === 'connected') {
        toast({
          title: "Connection Issue",
          description: healthResult.error || "GPS51 connection test failed",
          variant: "destructive",
        });
      } else if (healthResult.success && state.status === 'error') {
        toast({
          title: "Connection Restored",
          description: `GPS51 connection restored (${healthResult.latency}ms)`,
        });
      }

      console.log('useGPS51DirectConnection: Health check completed:', {
        success: healthResult.success,
        latency: healthResult.latency,
        status: newStatus,
        isHealthy
      });

    } catch (error) {
      if (!isMounted.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      console.error('useGPS51DirectConnection: Connection test error:', errorMessage);

      setState(prev => ({
        ...prev,
        status: 'error',
        isHealthy: false,
        lastCheck: Date.now(),
        errorCount: prev.errorCount + 1
      }));

      // Add failed health check
      healthHistory.current.push({
        timestamp: Date.now(),
        latency: 0,
        success: false
      });

      updateMetrics();

      if (alertOnFailure) {
        toast({
          title: "Connection Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  }, [healthThreshold, alertOnFailure, onStatusChange, onHealthChange, state.isHealthy, state.status, toast, updateMetrics]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    console.log('useGPS51DirectConnection: Starting connection monitoring...', {
      checkInterval,
      healthThreshold
    });

    // Reset start time
    startTime.current = Date.now();

    // Initial test
    testConnection();

    // Start periodic monitoring
    if (monitoringTimer.current) {
      clearInterval(monitoringTimer.current);
    }

    monitoringTimer.current = setInterval(() => {
      testConnection();
    }, checkInterval);

    toast({
      title: "Connection Monitoring Started",
      description: `Health checks every ${checkInterval / 1000}s`,
    });
  }, [checkInterval, healthThreshold, testConnection, toast]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('useGPS51DirectConnection: Stopping connection monitoring...');

    if (monitoringTimer.current) {
      clearInterval(monitoringTimer.current);
      monitoringTimer.current = null;
    }

    setState(prev => ({ ...prev, status: 'disconnected' }));

    toast({
      title: "Connection Monitoring Stopped",
      description: "Health checks paused",
    });
  }, [toast]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    healthHistory.current = [];
    startTime.current = Date.now();
    
    setState(prev => ({
      ...prev,
      uptime: 0,
      errorCount: 0,
      metrics: {
        averageResponseTime: 0,
        successRate: 0,
        totalRequests: 0,
        activeRequests: 0,
        recentErrors: []
      }
    }));

    toast({
      title: "Metrics Reset",
      description: "Connection metrics have been reset",
    });
  }, [toast]);

  // Force reconnect
  const forceReconnect = useCallback(async (): Promise<void> => {
    console.log('useGPS51DirectConnection: Forcing reconnection...');

    setState(prev => ({ ...prev, status: 'connecting' }));

    try {
      // Try to refresh token first
      const refreshSuccess = await gps51DirectManager.auth.refreshToken();
      
      if (refreshSuccess) {
        await testConnection();
        toast({
          title: "Reconnection Successful",
          description: "GPS51 connection has been restored",
        });
      } else {
        setState(prev => ({ ...prev, status: 'error' }));
        toast({
          title: "Reconnection Failed",
          description: "Please check your credentials and try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Reconnection failed';
      setState(prev => ({ ...prev, status: 'error' }));
      
      toast({
        title: "Reconnection Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [testConnection, toast]);

  // Auto-start monitoring
  useEffect(() => {
    if (autoStart && gps51DirectManager.auth.isAuthenticated()) {
      startMonitoring();
    }

    return () => {
      if (monitoringTimer.current) {
        clearInterval(monitoringTimer.current);
      }
    };
  }, [autoStart, startMonitoring]);

  const actions: UseGPS51DirectConnectionActions = {
    testConnection,
    startMonitoring,
    stopMonitoring,
    resetMetrics,
    forceReconnect
  };

  const isConnected = state.status === 'connected' || state.status === 'degraded';
  const hasErrors = state.errorCount > 0 || state.metrics.recentErrors.length > 0;
  const needsAttention = state.status === 'error' || state.quality === 'poor' || state.errorCount > 3;

  return {
    state,
    actions,
    isConnected,
    hasErrors,
    needsAttention
  };
}
