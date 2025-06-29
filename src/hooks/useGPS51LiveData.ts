
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
  vehiclesWithGPS: number;
  vehiclesWithoutGPS: number;
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
    averageSpeed: 0,
    vehiclesWithGPS: 0,
    vehiclesWithoutGPS: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  const fetchLiveData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching live data with LEFT JOIN...');

      // Fetch ALL vehicles with their latest positions using LEFT JOIN
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!left(
            *
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) {
        console.error('Error fetching vehicles with positions:', vehiclesError);
        throw vehiclesError;
      }

      console.log('Fetched vehicles data:', vehiclesData?.length || 0, 'vehicles');

      // Separate vehicles with and without GPS data
      const allVehicles = vehiclesData || [];
      const vehiclesWithPositions = allVehicles.filter(v => 
        Array.isArray(v.vehicle_positions) ? v.vehicle_positions.length > 0 : !!v.vehicle_positions
      );
      const vehiclesWithoutPositions = allVehicles.filter(v => 
        Array.isArray(v.vehicle_positions) ? v.vehicle_positions.length === 0 : !v.vehicle_positions
      );

      console.log('Vehicles breakdown:', {
        total: allVehicles.length,
        withPositions: vehiclesWithPositions.length,
        withoutPositions: vehiclesWithoutPositions.length
      });

      // Transform vehicles with positions to GPS51Position format
      const transformedPositions: GPS51Position[] = [];
      
      for (const vehicle of vehiclesWithPositions) {
        const positions = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions 
          : [vehicle.vehicle_positions];
        
        // Get the latest position for each vehicle
        if (positions.length > 0) {
          const latestPosition = positions.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];

          transformedPositions.push({
            deviceid: vehicle.gps51_device_id || vehicle.license_plate,
            callat: Number(latestPosition.latitude),
            callon: Number(latestPosition.longitude),
            updatetime: new Date(latestPosition.timestamp).getTime(),
            speed: Number(latestPosition.speed || 0),
            moving: latestPosition.ignition_status ? 1 : 0,
            strstatus: latestPosition.address || (latestPosition.ignition_status ? 'Moving' : 'Stopped'),
            totaldistance: 0,
            course: Number(latestPosition.heading || 0),
            altitude: Number(latestPosition.altitude || 0),
            radius: Number(latestPosition.accuracy || 0),
            temp1: latestPosition.engine_temperature ? Number(latestPosition.engine_temperature) : undefined,
            fuel: latestPosition.fuel_level ? Number(latestPosition.fuel_level) : undefined,
            voltage: latestPosition.battery_level ? Number(latestPosition.battery_level) : undefined
          });
        }
      }

      console.log('Transformed positions:', transformedPositions.length);
      setPositions(transformedPositions);

      // Calculate comprehensive fleet metrics
      const totalDevices = allVehicles.length;
      const vehiclesWithGPS = vehiclesWithPositions.length;
      const vehiclesWithoutGPS = vehiclesWithoutPositions.length;
      
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      const activeDevices = transformedPositions.filter(p => 
        p.updatetime > fiveMinutesAgo
      ).length;
      
      const movingVehicles = transformedPositions.filter(p => p.moving === 1).length;
      const parkedDevices = transformedPositions.filter(p => p.moving === 0).length;
      const offlineVehicles = vehiclesWithGPS - activeDevices;
      const totalDistance = transformedPositions.reduce((sum, p) => sum + p.totaldistance, 0);
      
      const movingDevicesWithSpeed = transformedPositions.filter(p => p.moving === 1 && p.speed > 0);
      const averageSpeed = movingDevicesWithSpeed.length > 0 
        ? movingDevicesWithSpeed.reduce((sum, p) => sum + p.speed, 0) / movingDevicesWithSpeed.length
        : 0;

      const newMetrics = {
        totalDevices,
        activeDevices,
        movingVehicles,
        parkedDevices,
        offlineVehicles,
        totalDistance,
        averageSpeed: Math.round(averageSpeed),
        vehiclesWithGPS,
        vehiclesWithoutGPS
      };

      setMetrics(newMetrics);

      console.log('Comprehensive fleet metrics:', newMetrics);
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
    console.log('Manually refreshing live data...');
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
