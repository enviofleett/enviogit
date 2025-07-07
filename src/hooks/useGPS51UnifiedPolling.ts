import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51MasterPollingService } from '@/services/gps51/GPS51MasterPollingService';
import type { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface UnifiedPollingState {
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastQueryTime: number;
  isPolling: boolean;
  loading: boolean;
  error: string | null;
  
  // Unified metrics
  metrics: {
    totalApiCalls: number;
    successRate: number;
    averageResponseTime: number;
    activePollingVehicles: number;
    pollingEfficiency: number;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export interface UnifiedPollingOptions {
  deviceIds?: string[];
  pollingInterval?: number;
  priority?: 'high' | 'normal' | 'low';
  autoStart?: boolean;
  userId?: string;
  isViewingRealTime?: boolean;
  enableAdaptive?: boolean;
  enableIntelligentOrchestration?: boolean;
}

export interface UseGPS51UnifiedPollingReturn {
  state: UnifiedPollingState;
  actions: {
    startPolling: () => void;
    stopPolling: () => void;
    forceRefresh: () => Promise<void>;
    updateInterval: (interval: number) => void;
    updateDevices: (deviceIds: string[]) => void;
    registerUserActivity: (userId: string, vehicleIds: string[], isViewingRealTime?: boolean) => void;
    unregisterUserActivity: (userId: string) => void;
  };
  advanced: {
    getMetrics: () => any;
    isHealthy: boolean;
    getRecommendedInterval: () => number;
    emergencyStop: () => void;
  };
}

export const useGPS51UnifiedPolling = (
  options: UnifiedPollingOptions = {}
): UseGPS51UnifiedPollingReturn => {
  const {
    deviceIds = [],
    pollingInterval = 30000,
    priority = 'normal',
    autoStart = false,
    userId,
    isViewingRealTime = false,
    enableAdaptive = true,
    enableIntelligentOrchestration = true
  } = options;

  const sessionIdRef = useRef<string>(`session_${crypto.randomUUID()}`);
  const [state, setState] = useState<UnifiedPollingState>({
    devices: [],
    positions: [],
    lastQueryTime: 0,
    isPolling: false,
    loading: false,
    error: null,
    metrics: {
      totalApiCalls: 0,
      successRate: 100,
      averageResponseTime: 0,
      activePollingVehicles: 0,
      pollingEfficiency: 100,
      circuitBreakerState: 'closed',
      riskLevel: 'low'
    }
  });

  const currentDeviceIds = useRef<string[]>(deviceIds);
  const currentInterval = useRef<number>(pollingInterval);
  const currentPriority = useRef<'high' | 'normal' | 'low'>(priority);

  // Data update callback for the master polling service
  const handleDataUpdate = useCallback((data: {
    devices: GPS51Device[];
    positions: GPS51Position[];
    lastQueryTime: number;
  }) => {
    setState(prev => ({
      ...prev,
      devices: data.devices,
      positions: data.positions,
      lastQueryTime: data.lastQueryTime,
      loading: false,
      error: null
    }));

    console.log('useGPS51UnifiedPolling: Data updated', {
      sessionId: sessionIdRef.current,
      devices: data.devices.length,
      positions: data.positions.length,
      lastQueryTime: data.lastQueryTime
    });
  }, []);

  // Update metrics periodically
  const updateMetrics = useCallback(() => {
    try {
      const unifiedMetrics = gps51MasterPollingService.getUnifiedMetrics();
      const serviceStatus = gps51MasterPollingService.getStatus();

      setState(prev => ({
        ...prev,
        metrics: {
          totalApiCalls: unifiedMetrics.orchestrationMetrics.totalApiCalls,
          successRate: unifiedMetrics.orchestrationMetrics.successRate,
          averageResponseTime: unifiedMetrics.orchestrationMetrics.averageResponseTime,
          activePollingVehicles: unifiedMetrics.orchestrationMetrics.activePollingVehicles,
          pollingEfficiency: unifiedMetrics.adaptiveMetrics.efficiencyScore,
          circuitBreakerState: unifiedMetrics.circuitBreakerState.state,
          riskLevel: unifiedMetrics.orchestrationMetrics.riskLevel
        },
        isPolling: serviceStatus.isPolling
      }));
    } catch (error) {
      console.error('useGPS51UnifiedPolling: Failed to update metrics:', error);
    }
  }, []);

  // Start polling
  const startPolling = useCallback(() => {
    if (currentDeviceIds.current.length === 0) {
      console.warn('useGPS51UnifiedPolling: No device IDs provided for polling');
      return;
    }

    console.log('useGPS51UnifiedPolling: Starting unified polling', {
      sessionId: sessionIdRef.current,
      deviceIds: currentDeviceIds.current,
      interval: currentInterval.current,
      priority: currentPriority.current
    });

    setState(prev => ({ ...prev, loading: true, error: null }));

    // Register with intelligent orchestration if enabled
    if (enableIntelligentOrchestration && userId) {
      gps51MasterPollingService.registerUserActivity(
        userId,
        currentDeviceIds.current,
        isViewingRealTime
      );
    }

    // Register session with master polling service
    gps51MasterPollingService.registerSession(
      sessionIdRef.current,
      currentDeviceIds.current,
      currentInterval.current,
      handleDataUpdate,
      currentPriority.current
    );

    setState(prev => ({ ...prev, isPolling: true }));
  }, [handleDataUpdate, userId, isViewingRealTime, enableIntelligentOrchestration]);

  // Stop polling
  const stopPolling = useCallback(() => {
    console.log('useGPS51UnifiedPolling: Stopping unified polling', {
      sessionId: sessionIdRef.current
    });

    // Unregister from intelligent orchestration
    if (enableIntelligentOrchestration && userId) {
      gps51MasterPollingService.unregisterUserActivity(userId);
    }

    // Unregister session
    gps51MasterPollingService.unregisterSession(sessionIdRef.current);
    
    setState(prev => ({
      ...prev,
      isPolling: false,
      loading: false
    }));
  }, [userId, enableIntelligentOrchestration]);

  // Force refresh
  const forceRefresh = useCallback(async () => {
    if (!state.isPolling) {
      console.warn('useGPS51UnifiedPolling: Cannot force refresh - polling not active');
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await gps51MasterPollingService.forcePoll(sessionIdRef.current);
      console.log('useGPS51UnifiedPolling: Force refresh completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Force refresh failed';
      setState(prev => ({ ...prev, error: errorMessage, loading: false }));
      console.error('useGPS51UnifiedPolling: Force refresh failed:', error);
    }
  }, [state.isPolling]);

  // Update polling interval
  const updateInterval = useCallback((newInterval: number) => {
    currentInterval.current = newInterval;
    
    if (state.isPolling) {
      gps51MasterPollingService.updateSession(sessionIdRef.current, {
        interval: newInterval
      });
    }

    console.log('useGPS51UnifiedPolling: Updated interval', {
      sessionId: sessionIdRef.current,
      newInterval
    });
  }, [state.isPolling]);

  // Update device list
  const updateDevices = useCallback((newDeviceIds: string[]) => {
    currentDeviceIds.current = newDeviceIds;
    
    if (state.isPolling) {
      gps51MasterPollingService.updateSession(sessionIdRef.current, {
        deviceIds: newDeviceIds
      });
      
      // Update intelligent orchestration if enabled
      if (enableIntelligentOrchestration && userId) {
        gps51MasterPollingService.registerUserActivity(
          userId,
          newDeviceIds,
          isViewingRealTime
        );
      }
    }

    console.log('useGPS51UnifiedPolling: Updated devices', {
      sessionId: sessionIdRef.current,
      deviceCount: newDeviceIds.length
    });
  }, [state.isPolling, userId, isViewingRealTime, enableIntelligentOrchestration]);

  // Register user activity
  const registerUserActivity = useCallback((
    activityUserId: string,
    vehicleIds: string[],
    viewingRealTime = false
  ) => {
    if (enableIntelligentOrchestration) {
      gps51MasterPollingService.registerUserActivity(
        activityUserId,
        vehicleIds,
        viewingRealTime
      );
    }
  }, [enableIntelligentOrchestration]);

  // Unregister user activity
  const unregisterUserActivity = useCallback((activityUserId: string) => {
    if (enableIntelligentOrchestration) {
      gps51MasterPollingService.unregisterUserActivity(activityUserId);
    }
  }, [enableIntelligentOrchestration]);

  // Get comprehensive metrics
  const getMetrics = useCallback(() => {
    return gps51MasterPollingService.getUnifiedMetrics();
  }, []);

  // Check if system is healthy
  const isHealthy = state.metrics.circuitBreakerState === 'closed' && 
                   state.metrics.successRate > 90 && 
                   state.metrics.riskLevel !== 'high';

  // Get recommended interval based on current conditions
  const getRecommendedInterval = useCallback(() => {
    const metrics = gps51MasterPollingService.getUnifiedMetrics();
    const baseInterval = currentInterval.current;
    
    // Adjust based on risk level
    const riskMultiplier = {
      'low': 1.0,
      'medium': 1.3,
      'high': 2.0
    }[metrics.orchestrationMetrics.riskLevel];

    return Math.round(baseInterval * riskMultiplier);
  }, []);

  // Emergency stop
  const emergencyStop = useCallback(() => {
    console.warn('useGPS51UnifiedPolling: Emergency stop triggered');
    gps51MasterPollingService.emergencyStop();
    setState(prev => ({
      ...prev,
      isPolling: false,
      loading: false,
      error: 'Emergency stop activated'
    }));
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !state.isPolling && currentDeviceIds.current.length > 0) {
      startPolling();
    }
  }, [autoStart, state.isPolling, startPolling]);

  // Update metrics periodically
  useEffect(() => {
    const metricsInterval = setInterval(updateMetrics, 10000); // Every 10 seconds
    updateMetrics(); // Initial update

    return () => clearInterval(metricsInterval);
  }, [updateMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isPolling) {
        stopPolling();
      }
    };
  }, [state.isPolling, stopPolling]);

  return {
    state,
    actions: {
      startPolling,
      stopPolling,
      forceRefresh,
      updateInterval,
      updateDevices,
      registerUserActivity,
      unregisterUserActivity
    },
    advanced: {
      getMetrics,
      isHealthy,
      getRecommendedInterval,
      emergencyStop
    }
  };
};

// Legacy compatibility wrappers - these convert the new unified hook to match old interfaces
export const useGPS51LiveDataPolling = (
  options: { enabled?: boolean; pollingInterval?: number; autoStart?: boolean },
  onDataUpdate: (data: any) => void,
  onError: (error: string) => void,
  setLoading: (loading: boolean) => void
) => {
  const unified = useGPS51UnifiedPolling({
    pollingInterval: options.pollingInterval,
    autoStart: options.autoStart && options.enabled,
    priority: 'normal'
  });

  useEffect(() => {
    onDataUpdate({
      devices: unified.state.devices,
      positions: unified.state.positions,
      lastQueryPositionTime: unified.state.lastQueryTime
    });
  }, [unified.state.devices, unified.state.positions, unified.state.lastQueryTime, onDataUpdate]);

  useEffect(() => {
    setLoading(unified.state.loading);
  }, [unified.state.loading, setLoading]);

  useEffect(() => {
    if (unified.state.error) {
      onError(unified.state.error);
    }
  }, [unified.state.error, onError]);

  return {
    refresh: unified.actions.forceRefresh,
    startPolling: unified.actions.startPolling,
    stopPolling: unified.actions.stopPolling,
    service: { getCurrentState: () => unified.state }
  };
};

export const useGPS51SmartPolling = (config: any = {}) => {
  const unified = useGPS51UnifiedPolling({
    pollingInterval: config.baseInterval || 30000,
    enableAdaptive: true,
    enableIntelligentOrchestration: true,
    priority: 'normal'
  });

  return {
    state: {
      isActive: unified.state.isPolling,
      currentInterval: unified.advanced.getRecommendedInterval(),
      activeDevices: unified.state.positions.filter(p => Date.now() - new Date(p.updatetime).getTime() < 30 * 60 * 1000).length,
      inactiveDevices: unified.state.devices.length - unified.state.positions.length,
      lastAdaptation: Date.now(),
      pollingEfficiency: unified.state.metrics.pollingEfficiency
    },
    startSmartPolling: (deviceIds?: string[]) => {
      if (deviceIds) unified.actions.updateDevices(deviceIds);
      unified.actions.startPolling();
    },
    stopSmartPolling: unified.actions.stopPolling,
    adjustConfig: () => {},
    getOptimalInterval: unified.advanced.getRecommendedInterval
  };
};

export const useGPS51IntelligentMonitoring = (options: any = {}) => {
  const unified = useGPS51UnifiedPolling({
    userId: options.userId,
    isViewingRealTime: options.isViewingRealTime,
    autoStart: options.autoStart,
    enableIntelligentOrchestration: true,
    priority: 'normal'
  });

  return {
    isActive: unified.state.isPolling,
    metrics: unified.state.metrics,
    vehicleStrategies: new Map(),
    lastUpdate: new Date(),
    derivedMetrics: {
      isHealthy: unified.advanced.isHealthy,
      apiEfficiency: 100,
      connectionStability: unified.state.metrics.circuitBreakerState === 'closed',
      vehicleDistribution: { high: 0, medium: 0, low: 0 }
    },
    startMonitoring: unified.actions.startPolling,
    stopMonitoring: unified.actions.stopPolling,
    updateUserActivity: unified.actions.registerUserActivity,
    forceVehicleUpdate: unified.actions.forceRefresh,
    isHealthy: unified.advanced.isHealthy,
    getVehicleStrategy: () => undefined,
    getActiveVehicleCount: () => unified.state.metrics.activePollingVehicles,
    getRiskLevel: () => unified.state.metrics.riskLevel
  };
};