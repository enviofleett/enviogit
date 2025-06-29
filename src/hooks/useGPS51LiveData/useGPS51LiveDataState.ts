
import { useState } from 'react';
import { GPS51Position, FleetMetrics } from './types';

export const useGPS51LiveDataState = () => {
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
  const [retries, setRetries] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  return {
    positions,
    setPositions,
    metrics,
    setMetrics,
    loading,
    setLoading,
    error,
    setError,
    retries,
    setRetries,
    lastSyncTime,
    setLastSyncTime
  };
};
