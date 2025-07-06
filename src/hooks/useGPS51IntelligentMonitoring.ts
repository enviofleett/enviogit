import { useState, useEffect, useCallback } from 'react';
import { gps51IntelligentOrchestrator } from '@/services/gps51/GPS51IntelligentOrchestrator';
import type { OrchestratorMetrics, VehiclePollingStrategy } from '@/services/gps51/GPS51IntelligentOrchestrator';

interface GPS51MonitoringState {
  isActive: boolean;
  metrics: OrchestratorMetrics;
  vehicleStrategies: Map<string, VehiclePollingStrategy>;
  lastUpdate: Date | null;
}

interface UseGPS51IntelligentMonitoringOptions {
  userId?: string;
  autoStart?: boolean;
  updateInterval?: number;
  vehicleIds?: string[];
  isViewingRealTime?: boolean;
}

export const useGPS51IntelligentMonitoring = (options: UseGPS51IntelligentMonitoringOptions = {}) => {
  const {
    userId,
    autoStart = false,
    updateInterval = 5000,
    vehicleIds = [],
    isViewingRealTime = false
  } = options;

  const [monitoringState, setMonitoringState] = useState<GPS51MonitoringState>({
    isActive: false,
    metrics: gps51IntelligentOrchestrator.getOrchestratorMetrics(),
    vehicleStrategies: gps51IntelligentOrchestrator.getVehicleStrategies(),
    lastUpdate: null
  });

  // Start monitoring
  const startMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      console.log('useGPS51IntelligentMonitoring: Starting intelligent monitoring...');
      
      const success = await gps51IntelligentOrchestrator.startOrchestration();
      
      if (success && userId && vehicleIds.length > 0) {
        // Register user activity for intelligent polling optimization
        gps51IntelligentOrchestrator.registerUserActivity(
          userId,
          vehicleIds,
          isViewingRealTime
        );
        
        console.log('useGPS51IntelligentMonitoring: User activity registered', {
          userId,
          vehicleCount: vehicleIds.length,
          isViewingRealTime
        });
      }

      setMonitoringState(prev => ({
        ...prev,
        isActive: success,
        lastUpdate: new Date()
      }));

      return success;
    } catch (error) {
      console.error('useGPS51IntelligentMonitoring: Failed to start monitoring:', error);
      return false;
    }
  }, [userId, vehicleIds, isViewingRealTime]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('useGPS51IntelligentMonitoring: Stopping monitoring...');
    
    gps51IntelligentOrchestrator.stopOrchestration();
    
    if (userId) {
      gps51IntelligentOrchestrator.unregisterUserActivity(userId);
    }

    setMonitoringState(prev => ({
      ...prev,
      isActive: false,
      lastUpdate: new Date()
    }));
  }, [userId]);

  // Update user activity
  const updateUserActivity = useCallback((newVehicleIds: string[], newIsViewingRealTime = false) => {
    if (userId && monitoringState.isActive) {
      gps51IntelligentOrchestrator.registerUserActivity(
        userId,
        newVehicleIds,
        newIsViewingRealTime
      );
      
      console.log('useGPS51IntelligentMonitoring: User activity updated', {
        userId,
        vehicleCount: newVehicleIds.length,
        isViewingRealTime: newIsViewingRealTime
      });
    }
  }, [userId, monitoringState.isActive]);

  // Force update for specific vehicles
  const forceVehicleUpdate = useCallback(async (deviceIds: string[]) => {
    if (monitoringState.isActive) {
      await gps51IntelligentOrchestrator.forceVehicleUpdate(deviceIds);
      console.log('useGPS51IntelligentMonitoring: Force update triggered', { deviceIds });
    }
  }, [monitoringState.isActive]);

  // Update monitoring state periodically
  useEffect(() => {
    if (!monitoringState.isActive) return;

    const interval = setInterval(() => {
      setMonitoringState(prev => ({
        ...prev,
        metrics: gps51IntelligentOrchestrator.getOrchestratorMetrics(),
        vehicleStrategies: gps51IntelligentOrchestrator.getVehicleStrategies(),
        lastUpdate: new Date()
      }));
    }, updateInterval);

    return () => clearInterval(interval);
  }, [monitoringState.isActive, updateInterval]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !monitoringState.isActive) {
      startMonitoring();
    }
  }, [autoStart, monitoringState.isActive, startMonitoring]);

  // Listen for GPS51 position updates
  useEffect(() => {
    const handlePositionUpdate = (event: CustomEvent) => {
      const { deviceId, position } = event.detail;
      console.log('useGPS51IntelligentMonitoring: Position update received', { deviceId, position });
      
      // Update last update time to reflect real-time activity
      setMonitoringState(prev => ({
        ...prev,
        lastUpdate: new Date()
      }));
    };

    window.addEventListener('gps51-position-update', handlePositionUpdate as EventListener);
    
    return () => {
      window.removeEventListener('gps51-position-update', handlePositionUpdate as EventListener);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringState.isActive && userId) {
        gps51IntelligentOrchestrator.unregisterUserActivity(userId);
      }
    };
  }, [userId, monitoringState.isActive]);

  // Calculate derived metrics
  const derivedMetrics = {
    isHealthy: monitoringState.metrics.successRate > 95 && monitoringState.metrics.riskLevel !== 'high',
    apiEfficiency: monitoringState.metrics.callsPerMinute > 0 ? 
      (monitoringState.metrics.activePollingVehicles / monitoringState.metrics.callsPerMinute) : 0,
    connectionStability: monitoringState.metrics.circuitBreakerStatus === 'closed',
    vehicleDistribution: {
      high: Array.from(monitoringState.vehicleStrategies.values()).filter(s => s.priority === 'high').length,
      medium: Array.from(monitoringState.vehicleStrategies.values()).filter(s => s.priority === 'medium').length,
      low: Array.from(monitoringState.vehicleStrategies.values()).filter(s => s.priority === 'low').length
    }
  };

  return {
    // State
    isActive: monitoringState.isActive,
    metrics: monitoringState.metrics,
    vehicleStrategies: monitoringState.vehicleStrategies,
    lastUpdate: monitoringState.lastUpdate,
    derivedMetrics,

    // Actions
    startMonitoring,
    stopMonitoring,
    updateUserActivity,
    forceVehicleUpdate,

    // Helper functions
    isHealthy: derivedMetrics.isHealthy,
    getVehicleStrategy: (deviceId: string) => monitoringState.vehicleStrategies.get(deviceId),
    getActiveVehicleCount: () => monitoringState.metrics.activePollingVehicles,
    getRiskLevel: () => monitoringState.metrics.riskLevel
  };
};