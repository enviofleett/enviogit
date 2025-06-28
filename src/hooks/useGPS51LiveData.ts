
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GPS51Position {
  deviceid: string; // Fixed from deviceId
  callat: number; // Latitude (fixed from lat)
  callon: number; // Longitude (fixed from lon)
  updatetime: number;
  speed: number;
  moving: number; // 0: stop, 1: moving
  strstatus: string;
  totaldistance: number;
  course: number;
  altitude: number;
  radius: number;
}

export interface LiveDataOptions {
  enabled?: boolean; // Added missing property
  refreshInterval?: number;
  maxRetries?: number;
}

export interface FleetMetrics {
  totalDevices: number; // Added missing property
  activeDevices: number; // Added missing property
  movingVehicles: number; // Fixed from movingDevices
  parkedDevices: number; // Added missing property
  offlineVehicles: number; // Fixed from offlineDevices
  totalDistance: number;
  averageSpeed: number;
}

export const useGPS51LiveData = (options: LiveDataOptions = {}) => {
  const { enabled = true, refreshInterval = 30000, maxRetries = 3 } = options;
  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics>({
    totalDevices: 0,
    activeDevices: 0,
    movingVehicles: 0,
    parkedDevices: 0,
    offlineVehicles: 0,
    totalDistance: 0,
    averageSpeed: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  const fetchLiveData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch latest positions from our database
      const { data: positionsData, error: positionsError } = await supabase
        .from('vehicle_positions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (positionsError) throw positionsError;

      // Transform to GPS51Position format
      const transformedPositions: GPS51Position[] = positionsData?.map(pos => ({
        deviceid: pos.vehicle_id, // Fixed property name
        callat: Number(pos.latitude), // Fixed property name
        callon: Number(pos.longitude), // Fixed property name
        updatetime: new Date(pos.timestamp).getTime(),
        speed: Number(pos.speed || 0),
        moving: pos.ignition_status ? 1 : 0,
        strstatus: pos.ignition_status ? 'Moving' : 'Stopped',
        totaldistance: 0, // Would need to calculate from historical data
        course: Number(pos.heading || 0),
        altitude: Number(pos.altitude || 0),
        radius: Number(pos.accuracy || 0)
      })) || [];

      setPositions(transformedPositions);

      // Calculate fleet metrics
      const totalDevices = transformedPositions.length;
      const activeDevices = transformedPositions.filter(p => 
        Date.now() - p.updatetime < 300000 // Active within 5 minutes
      ).length;
      const movingVehicles = transformedPositions.filter(p => p.moving === 1).length;
      const parkedDevices = transformedPositions.filter(p => p.moving === 0).length;
      const offlineVehicles = totalDevices - activeDevices;
      const totalDistance = transformedPositions.reduce((sum, p) => sum + p.totaldistance, 0);
      const averageSpeed = activeDevices > 0 
        ? transformedPositions.filter(p => p.moving === 1).reduce((sum, p) => sum + p.speed, 0) / movingVehicles
        : 0;

      setMetrics({
        totalDevices,
        activeDevices,
        movingVehicles,
        parkedDevices,
        offlineVehicles,
        totalDistance,
        averageSpeed: Math.round(averageSpeed)
      });

      setRetries(0);
    } catch (err) {
      console.error('Error fetching GPS51 live data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      if (retries < maxRetries) {
        setRetries(prev => prev + 1);
        setTimeout(fetchLiveData, 5000); // Retry after 5 seconds
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, maxRetries, retries]);

  useEffect(() => {
    if (!enabled) return;

    fetchLiveData();

    const interval = setInterval(fetchLiveData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchLiveData, refreshInterval, enabled]);

  const refresh = useCallback(() => {
    setRetries(0);
    fetchLiveData();
  }, [fetchLiveData]);

  return {
    positions,
    metrics,
    loading,
    error,
    refresh
  };
};
