
import { useState, useEffect, useCallback, useRef } from 'react';
import { GPS51LiveDataService, LiveDataState, gps51LiveDataService } from '@/services/gps51/GPS51LiveDataService';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface LiveDataOptions {
  enabled?: boolean;
  pollingInterval?: number;
  maxRetries?: number;
  autoStart?: boolean;
}

export interface EnhancedFleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedVehicles: number;
  offlineVehicles: number;
  totalDistance: number;
  averageSpeed: number;
  devicesWithAlarms: number;
  fuelAlerts: number;
  temperatureAlerts: number;
  lastUpdateTime: Date | null;
  dataFreshness: 'live' | 'stale' | 'offline';
}

export interface VehicleWithEnhancedData {
  device: GPS51Device;
  position?: GPS51Position;
  isOnline: boolean;
  isMoving: boolean;
  hasAlarms: boolean;
  fuelLevel?: number;
  temperature?: number;
  batteryLevel?: number;
  lastSeen: Date | null;
}

export const useGPS51LiveDataEnhanced = (options: LiveDataOptions = {}) => {
  const {
    enabled = true,
    pollingInterval = 30000,
    maxRetries = 3,
    autoStart = true
  } = options;

  const [liveData, setLiveData] = useState<LiveDataState>({
    lastQueryPositionTime: 0,
    devices: [],
    positions: [],
    lastUpdate: new Date()
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<EnhancedFleetMetrics>({
    totalDevices: 0,
    activeDevices: 0,
    movingVehicles: 0,
    parkedVehicles: 0,
    offlineVehicles: 0,
    totalDistance: 0,
    averageSpeed: 0,
    devicesWithAlarms: 0,
    fuelAlerts: 0,
    temperatureAlerts: 0,
    lastUpdateTime: null,
    dataFreshness: 'offline'
  });

  const serviceRef = useRef<GPS51LiveDataService>(gps51LiveDataService);

  // Calculate enhanced metrics from live data
  const calculateMetrics = useCallback((data: LiveDataState): EnhancedFleetMetrics => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const devicesWithPositions = data.devices.map(device => {
      const position = data.positions.find(p => p.deviceid === device.deviceid);
      return { device, position };
    });

    const activeDevices = devicesWithPositions.filter(({ position }) => 
      position && position.updatetime > fiveMinutesAgo
    ).length;

    const movingVehicles = devicesWithPositions.filter(({ position }) => 
      position && position.moving === 1
    ).length;

    const parkedVehicles = devicesWithPositions.filter(({ position }) => 
      position && position.moving === 0 && position.updatetime > fiveMinutesAgo
    ).length;

    const offlineVehicles = data.devices.length - activeDevices;

    const totalDistance = data.positions.reduce((sum, position) => 
      sum + (position.totaldistance || 0), 0
    );

    const movingPositions = data.positions.filter(p => p.moving === 1 && p.speed > 0);
    const averageSpeed = movingPositions.length > 0 
      ? movingPositions.reduce((sum, p) => sum + p.speed, 0) / movingPositions.length
      : 0;

    const devicesWithAlarms = data.positions.filter(p => p.alarm && p.alarm > 0).length;
    
    const fuelAlerts = data.positions.filter(p => 
      p.totaloil !== undefined && p.totaloil < 20
    ).length;

    const temperatureAlerts = data.positions.filter(p => 
      (p.temp1 !== undefined && p.temp1 > 80) ||
      (p.temp2 !== undefined && p.temp2 > 80)
    ).length;

    const dataAge = now - data.lastUpdate.getTime();
    let dataFreshness: 'live' | 'stale' | 'offline' = 'offline';
    if (dataAge < 60000) dataFreshness = 'live'; // Less than 1 minute
    else if (dataAge < 300000) dataFreshness = 'stale'; // Less than 5 minutes

    return {
      totalDevices: data.devices.length,
      activeDevices,
      movingVehicles,
      parkedVehicles,
      offlineVehicles,
      totalDistance: Math.round(totalDistance / 1000), // Convert to km
      averageSpeed: Math.round(averageSpeed),
      devicesWithAlarms,
      fuelAlerts,
      temperatureAlerts,
      lastUpdateTime: data.lastUpdate,
      dataFreshness
    };
  }, []);

  // Get enhanced vehicle data
  const getEnhancedVehicles = useCallback((): VehicleWithEnhancedData[] => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    return liveData.devices.map(device => {
      const position = liveData.positions.find(p => p.deviceid === device.deviceid);
      
      return {
        device,
        position,
        isOnline: position ? position.updatetime > fiveMinutesAgo : false,
        isMoving: position ? position.moving === 1 : false,
        hasAlarms: position ? (position.alarm || 0) > 0 : false,
        fuelLevel: position?.totaloil,
        temperature: position?.temp1,
        batteryLevel: position?.voltagepercent,
        lastSeen: position ? new Date(position.updatetime) : null
      };
    });
  }, [liveData]);

  // Handle live data updates
  const handleLiveDataUpdate = useCallback((data: LiveDataState) => {
    setLiveData(data);
    setMetrics(calculateMetrics(data));
    setError(null);
  }, [calculateMetrics]);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await serviceRef.current.fetchLiveData();
      handleLiveDataUpdate(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('useGPS51LiveDataEnhanced: Manual refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, handleLiveDataUpdate]);

  // Start/stop polling
  const startPolling = useCallback(() => {
    if (!enabled) return;
    
    serviceRef.current.updatePollingInterval(pollingInterval);
    serviceRef.current.startPolling(handleLiveDataUpdate);
  }, [enabled, pollingInterval, handleLiveDataUpdate]);

  const stopPolling = useCallback(() => {
    serviceRef.current.stopPolling();
  }, []);

  // Effect for managing polling lifecycle
  useEffect(() => {
    if (enabled && autoStart) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, autoStart, startPolling, stopPolling]);

  // Get device by ID
  const getDeviceById = useCallback((deviceId: string) => {
    return serviceRef.current.getDeviceById(deviceId);
  }, []);

  // Get position by device ID
  const getPositionByDeviceId = useCallback((deviceId: string) => {
    return serviceRef.current.getPositionByDeviceId(deviceId);
  }, []);

  return {
    // Data
    liveData,
    metrics,
    vehicles: getEnhancedVehicles(),
    
    // State
    loading,
    error,
    
    // Actions
    refresh,
    startPolling,
    stopPolling,
    
    // Utilities
    getDeviceById,
    getPositionByDeviceId,
    
    // Service instance (for advanced usage)
    service: serviceRef.current
  };
};
