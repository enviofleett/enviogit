
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GPS51Position {
  deviceid: string; // GPS51 device ID
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

export interface LiveDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
}

export interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedDevices: number;
  offlineVehicles: number;
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

      // Fetch latest positions with vehicle information including GPS51 device IDs
      const { data: positionsData, error: positionsError } = await supabase
        .from('vehicle_positions')
        .select(`
          *,
          vehicles!inner(
            id,
            license_plate,
            gps51_device_id,
            brand,
            model,
            type,
            status
          )
        `)
        .order('timestamp', { ascending: false });

      if (positionsError) {
        console.error('Error fetching position data:', positionsError);
        throw positionsError;
      }

      console.log('Fetched position data:', positionsData?.length || 0, 'records');

      // Transform to GPS51Position format using GPS51 device IDs
      const transformedPositions: GPS51Position[] = positionsData?.map(pos => ({
        deviceid: pos.vehicles.gps51_device_id || pos.vehicles.license_plate, // Use GPS51 device ID or fallback to license plate
        callat: Number(pos.latitude),
        callon: Number(pos.longitude),
        updatetime: new Date(pos.timestamp).getTime(),
        speed: Number(pos.speed || 0),
        moving: pos.ignition_status ? 1 : 0,
        strstatus: pos.address || pos.ignition_status ? 'Moving' : 'Stopped',
        totaldistance: 0,
        course: Number(pos.heading || 0),
        altitude: Number(pos.altitude || 0),
        radius: Number(pos.accuracy || 0),
        temp1: pos.engine_temperature ? Number(pos.engine_temperature) : undefined,
        fuel: pos.fuel_level ? Number(pos.fuel_level) : undefined,
        voltage: pos.battery_level ? Number(pos.battery_level) : undefined
      })) || [];

      console.log('Transformed positions:', transformedPositions.length);

      setPositions(transformedPositions);

      // Calculate fleet metrics
      const totalDevices = transformedPositions.length;
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes threshold for active devices
      
      const activeDevices = transformedPositions.filter(p => 
        p.updatetime > fiveMinutesAgo
      ).length;
      
      const movingVehicles = transformedPositions.filter(p => p.moving === 1).length;
      const parkedDevices = transformedPositions.filter(p => p.moving === 0).length;
      const offlineVehicles = totalDevices - activeDevices;
      const totalDistance = transformedPositions.reduce((sum, p) => sum + p.totaldistance, 0);
      
      const movingDevicesWithSpeed = transformedPositions.filter(p => p.moving === 1 && p.speed > 0);
      const averageSpeed = movingDevicesWithSpeed.length > 0 
        ? movingDevicesWithSpeed.reduce((sum, p) => sum + p.speed, 0) / movingDevicesWithSpeed.length
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

      console.log('Fleet metrics calculated:', {
        totalDevices,
        activeDevices,
        movingVehicles,
        parkedDevices,
        offlineVehicles,
        averageSpeed: Math.round(averageSpeed)
      });

      setRetries(0);
    } catch (err) {
      console.error('Error fetching GPS51 live data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      if (retries < maxRetries) {
        setRetries(prev => prev + 1);
        setTimeout(fetchLiveData, 5000);
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
