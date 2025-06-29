
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { gps51PollingService } from '@/services/gps51/GPS51PollingService';

export interface EnhancedGPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  moving: number;
  strstatus: string;
  course: number;
  altitude: number;
  radius: number;
  temp1?: number;
  voltage?: number;
  fuel?: number;
  voltagepercent?: number;
}

export interface EnhancedFleetMetrics {
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
  enablePolling?: boolean;
  priority?: number;
}

export const useGPS51EnhancedLiveData = (options: LiveDataOptions = {}) => {
  const { 
    enabled = true, 
    refreshInterval = 10000, 
    maxRetries = 3,
    enablePolling = true,
    priority = 1
  } = options;

  const [positions, setPositions] = useState<EnhancedGPS51Position[]>([]);
  const [metrics, setMetrics] = useState<EnhancedFleetMetrics>({
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

  const fetchLiveData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching enhanced GPS51 live data...');

      // Fetch vehicles with their latest positions
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!left(
            vehicle_id, latitude, longitude, speed, timestamp, address, 
            ignition_status, heading, fuel_level, engine_temperature,
            battery_level, altitude, accuracy
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) {
        console.error('Error fetching vehicles with positions:', vehiclesError);
        throw vehiclesError;
      }

      console.log('Fetched vehicles data:', vehiclesData?.length || 0, 'vehicles');

      const allVehicles = vehiclesData || [];
      const vehiclesWithPositions = allVehicles.filter(v => 
        Array.isArray(v.vehicle_positions) ? v.vehicle_positions.length > 0 : !!v.vehicle_positions
      );

      // Transform to GPS51 position format
      const transformedPositions: EnhancedGPS51Position[] = [];
      
      for (const vehicle of vehiclesWithPositions) {
        const positions = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions 
          : [vehicle.vehicle_positions];
        
        if (positions.length > 0) {
          const latestPosition = positions.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];

          const gps51Position: EnhancedGPS51Position = {
            deviceid: vehicle.gps51_device_id || vehicle.license_plate,
            callat: Number(latestPosition.latitude),
            callon: Number(latestPosition.longitude),
            updatetime: new Date(latestPosition.timestamp).getTime(),
            speed: Number(latestPosition.speed || 0),
            moving: latestPosition.ignition_status ? 1 : 0,
            strstatus: latestPosition.address || 'Unknown location',
            course: Number(latestPosition.heading || 0),
            altitude: Number(latestPosition.altitude || 0),
            radius: Number(latestPosition.accuracy || 0),
            temp1: latestPosition.engine_temperature ? Number(latestPosition.engine_temperature) : undefined,
            voltage: latestPosition.battery_level ? Number(latestPosition.battery_level) : undefined,
            fuel: latestPosition.fuel_level ? Number(latestPosition.fuel_level) : undefined,
            voltagepercent: latestPosition.fuel_level ? Number(latestPosition.fuel_level) : undefined
          };

          transformedPositions.push(gps51Position);
        }
      }

      console.log('Transformed positions:', transformedPositions.length);
      setPositions(transformedPositions);

      // Calculate enhanced fleet metrics
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      const totalDevices = allVehicles.length;
      const vehiclesWithGPS = vehiclesWithPositions.length;
      const vehiclesWithoutGPS = totalDevices - vehiclesWithGPS;
      
      const activeDevices = transformedPositions.filter(p => 
        p.updatetime > fiveMinutesAgo
      ).length;
      
      const movingVehicles = transformedPositions.filter(p => p.moving === 1).length;
      const parkedDevices = transformedPositions.filter(p => 
        p.moving === 0 && p.updatetime > fiveMinutesAgo
      ).length;
      const offlineVehicles = vehiclesWithGPS - activeDevices;
      
      const movingDevicesWithSpeed = transformedPositions.filter(p => p.moving === 1 && p.speed > 0);
      const averageSpeed = movingDevicesWithSpeed.length > 0 
        ? movingDevicesWithSpeed.reduce((sum, p) => sum + p.speed, 0) / movingDevicesWithSpeed.length
        : 0;

      const newMetrics: EnhancedFleetMetrics = {
        totalDevices,
        activeDevices,
        movingVehicles,
        parkedDevices,
        offlineVehicles,
        totalDistance: 0, // Would need to be calculated from historical data
        averageSpeed: Math.round(averageSpeed),
        vehiclesWithGPS,
        vehiclesWithoutGPS,
        realTimeConnected: gps51PollingService.isActive(),
        lastUpdateTime: new Date()
      };

      setMetrics(newMetrics);
      setLastSyncTime(new Date());

      console.log('Enhanced live data metrics:', newMetrics);
      
    } catch (err) {
      console.error('Error fetching GPS51 enhanced live data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Start/stop polling service
  useEffect(() => {
    if (!enabled) {
      gps51PollingService.stopPolling();
      return;
    }

    if (enablePolling) {
      gps51PollingService.startPolling({
        interval: refreshInterval,
        enabled: true,
        priority: priority
      });
    }

    // Initial fetch
    fetchLiveData();

    // Set up manual refresh interval for UI updates
    const interval = setInterval(fetchLiveData, refreshInterval);

    return () => {
      clearInterval(interval);
      if (enablePolling) {
        gps51PollingService.stopPolling();
      }
    };
  }, [fetchLiveData, refreshInterval, enabled, enablePolling, priority]);

  const refresh = useCallback(() => {
    console.log('Manually refreshing enhanced live data...');
    fetchLiveData();
  }, [fetchLiveData]);

  const triggerPrioritySync = useCallback(async (vehicleIds: string[]) => {
    console.log('Triggering priority sync for vehicles:', vehicleIds);
    
    try {
      const credentials = {
        username: localStorage.getItem('gps51_username'),
        password: localStorage.getItem('gps51_password_hash'),
        apiUrl: localStorage.getItem('gps51_api_url')
      };

      if (!credentials.username || !credentials.password || !credentials.apiUrl) {
        throw new Error('GPS51 credentials not available');
      }

      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          ...credentials,
          priority: 1, // High priority
          batchMode: false
        }
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        console.log('Priority sync successful');
        await fetchLiveData(); // Refresh data after sync
      }
    } catch (error) {
      console.error('Priority sync failed:', error);
      setError(error instanceof Error ? error.message : 'Priority sync failed');
    }
  }, [fetchLiveData]);

  return {
    positions,
    metrics,
    loading,
    error,
    lastSyncTime,
    refresh,
    triggerPrioritySync,
    pollingActive: gps51PollingService.isActive()
  };
};
