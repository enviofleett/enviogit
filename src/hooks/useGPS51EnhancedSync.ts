import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51EnhancedSyncService, EnhancedSyncOptions } from '@/services/gps51/GPS51EnhancedSyncService';
import { EnhancedLiveDataState } from '@/services/gps51/GPS51EnhancedStateManager';

export interface GPS51EnhancedSyncStatus {
  isActive: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  activeDevices: number;
  idleDevices: number;
  inactiveDevices: number;
  totalDevices: number;
  error: string | null;
  performance: {
    successRate: number;
    averageResponseTime: number;
    currentPollingInterval: number;
    circuitState: 'closed' | 'open' | 'half-open';
  };
}

export const useGPS51EnhancedSync = (enableSync: boolean = true, options?: EnhancedSyncOptions) => {
  const [status, setStatus] = useState<GPS51EnhancedSyncStatus>({
    isActive: false,
    isConnected: false,
    lastUpdate: null,
    activeDevices: 0,
    idleDevices: 0,
    inactiveDevices: 0,
    totalDevices: 0,
    error: null,
    performance: {
      successRate: 0,
      averageResponseTime: 0,
      currentPollingInterval: 30000,
      circuitState: 'closed'
    }
  });

  const [enhancedData, setEnhancedData] = useState<EnhancedLiveDataState | null>(null);
  const serviceRef = useRef(gps51EnhancedSyncService);

  // Initialize service with options if provided
  useEffect(() => {
    if (options) {
      serviceRef.current = gps51EnhancedSyncService;
    }
  }, [options]);

  const updateStatus = useCallback((data: EnhancedLiveDataState) => {
    const serviceStatus = serviceRef.current.getEnhancedServiceStatus();
    
    // Calculate device activity counts from the state data
    const activeDevices = data.positions.filter(pos => 
      pos.updatetime && (Date.now() - new Date(pos.updatetime).getTime() < 5 * 60 * 1000) && pos.moving === 1
    ).length;
    
    const idleDevices = data.positions.filter(pos => 
      pos.updatetime && 
      (Date.now() - new Date(pos.updatetime).getTime() < 30 * 60 * 1000) &&
      (Date.now() - new Date(pos.updatetime).getTime() >= 5 * 60 * 1000)
    ).length;
    
    const inactiveDevices = data.devices.length - activeDevices - idleDevices;
    
    setStatus({
      isActive: serviceStatus.polling.isActive,
      isConnected: true,
      lastUpdate: data.lastUpdate,
      activeDevices,
      idleDevices,
      inactiveDevices,
      totalDevices: data.devices.length,
      error: null,
      performance: {
        successRate: serviceStatus.sync.successRate,
        averageResponseTime: serviceStatus.sync.averageResponseTime,
        currentPollingInterval: serviceStatus.polling.currentInterval,
        circuitState: serviceStatus.polling.circuitState
      }
    });

    setEnhancedData(data);
  }, []);

  const handleSyncError = useCallback((error: Error) => {
    console.error('useGPS51EnhancedSync: Sync error:', error);
    setStatus(prev => ({
      ...prev,
      isActive: false,
      isConnected: false,
      error: error.message
    }));
  }, []);

  // Start/stop enhanced sync
  useEffect(() => {
    if (!enableSync) {
      serviceRef.current.stopEnhancedPolling();
      setStatus(prev => ({ ...prev, isActive: false }));
      return;
    }

    console.log('🚀 Starting GPS51 Enhanced Sync...');

    try {
      // Start enhanced polling with callback
      serviceRef.current.startEnhancedPolling((data) => {
        updateStatus(data);
      });

      // Initial status update
      const initialData = serviceRef.current.getCurrentEnhancedState();
      updateStatus(initialData);

    } catch (error) {
      handleSyncError(error as Error);
    }

    return () => {
      serviceRef.current.stopEnhancedPolling();
    };
  }, [enableSync, updateStatus, handleSyncError]);

  // Force sync function
  const forceSync = useCallback(async () => {
    try {
      console.log('🔄 Forcing GPS51 Enhanced Sync...');
      const data = await serviceRef.current.fetchEnhancedLiveData();
      updateStatus(data);
    } catch (error) {
      handleSyncError(error as Error);
    }
  }, [updateStatus, handleSyncError]);

  // Get service debug info
  const getDebugInfo = useCallback(() => {
    return serviceRef.current.exportDebugInfo();
  }, []);

  // Get comprehensive service status
  const getServiceStatus = useCallback(() => {
    return serviceRef.current.getEnhancedServiceStatus();
  }, []);

  // Reset service
  const resetService = useCallback(() => {
    serviceRef.current.resetEnhancedService();
    setStatus({
      isActive: false,
      isConnected: false,
      lastUpdate: null,
      activeDevices: 0,
      idleDevices: 0,
      inactiveDevices: 0,
      totalDevices: 0,
      error: null,
      performance: {
        successRate: 0,
        averageResponseTime: 0,
        currentPollingInterval: 30000,
        circuitState: 'closed'
      }
    });
    setEnhancedData(null);
  }, []);

  // Get devices by activity status
  const getDevicesByActivity = useCallback((activityStatus: 'active' | 'idle' | 'inactive') => {
    const currentState = serviceRef.current.getCurrentEnhancedState();
    return currentState.devices.filter(device => {
      const state = serviceRef.current['stateManager']?.getDeviceActivityStatus(device.deviceid);
      return state === activityStatus;
    });
  }, []);

  // Get device with latest position
  const getDevicesWithPositions = useCallback(() => {
    const currentState = serviceRef.current.getCurrentEnhancedState();
    return currentState.devices.map(device => ({
      device,
      position: currentState.positions.find(pos => pos.deviceid === device.deviceid),
      activityStatus: serviceRef.current['stateManager']?.getDeviceActivityStatus(device.deviceid) || 'unknown'
    }));
  }, []);

  return {
    // Core data
    status,
    enhancedData,
    
    // Device data with enhanced info
    devices: enhancedData?.devices || [],
    positions: enhancedData?.positions || [],
    
    // Enhanced getters
    getDevicesByActivity,
    getDevicesWithPositions,
    
    // Control functions
    forceSync,
    resetService,
    
    // Debug and monitoring
    getDebugInfo,
    getServiceStatus,
    
    // Legacy compatibility
    liveData: enhancedData?.positions || []
  };
};