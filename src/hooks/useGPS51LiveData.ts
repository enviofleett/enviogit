import { useState, useCallback } from 'react';

export interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  moving: number;
  strstatus: string;
  totaldistance: number;
  course: number;
  altitude: number;
  radius: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
}

export interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedDevices: number;
  offlineVehicles: number;
  totalDistance: number;
  averageSpeed: number;
  vehiclesWithGPS: number;
  vehiclesWithoutGPS: number;
  realTimeConnected: boolean;
  lastUpdateTime: Date | null;
}

export interface LiveDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
  enableWebSocket?: boolean;
  enableIntelligentFiltering?: boolean;
}

// Stub implementation until database schema is ready
export const useGPS51LiveData = (options: LiveDataOptions = {}) => {
  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics>({
    totalDevices: 0,
    activeDevices: 0,
    movingVehicles: 0,
    parkedDevices: 0,
    offlineVehicles: 0,
    totalDistance: 0,
    averageSpeed: 0,
    vehiclesWithGPS: 0,
    vehiclesWithoutGPS: 0,
    realTimeConnected: false,
    lastUpdateTime: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    console.log('GPS51 Live Data service temporarily disabled - database schema pending');
  }, []);

  const triggerPrioritySync = useCallback((vehicleIds: string[]) => {
    console.log('Priority sync temporarily disabled - database schema pending');
  }, []);

  return {
    positions,
    metrics,
    loading,
    error,
    lastSyncTime,
    refresh,
    triggerPrioritySync,
    intelligentFiltering: null,
    scalingMetrics: {},
    budgetStatus: {},
    optimizationInsights: {}
  };
};