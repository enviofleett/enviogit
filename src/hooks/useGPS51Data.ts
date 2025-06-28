
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';

interface VehiclePosition {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  ignition_status: boolean;
  fuel_level?: number;
  engine_temperature?: number;
  battery_level?: number;
  address?: string;
}

interface VehicleData {
  id: string;
  license_plate: string;
  brand?: string;
  model?: string;
  type: string;
  status: string;
  latest_position?: VehiclePosition;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useGPS51Data = () => {
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Fetch vehicles and their latest positions
  const fetchVehicleData = async () => {
    try {
      setLoading(true);
      
      // Fetch vehicles from the vehicles table
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      // Fetch latest positions separately
      const { data: positionsData, error: positionsError } = await supabase
        .from('vehicle_positions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (positionsError) {
        console.warn('Error fetching positions:', positionsError);
      }

      // Transform vehicles data
      const transformedVehicles: VehicleData[] = vehiclesData?.map(vehicle => {
        // Find latest position for this vehicle
        const latestPositionData = positionsData?.find(pos => pos.vehicle_id === vehicle.id);

        let latest_position: VehiclePosition | undefined;
        if (latestPositionData) {
          latest_position = {
            vehicle_id: vehicle.id,
            latitude: Number(latestPositionData.latitude),
            longitude: Number(latestPositionData.longitude),
            speed: Number(latestPositionData.speed || 0),
            heading: Number(latestPositionData.heading || 0),
            timestamp: latestPositionData.timestamp,
            ignition_status: latestPositionData.ignition_status || false,
            fuel_level: latestPositionData.fuel_level ? Number(latestPositionData.fuel_level) : undefined,
            engine_temperature: latestPositionData.engine_temperature ? Number(latestPositionData.engine_temperature) : undefined,
            battery_level: latestPositionData.battery_level ? Number(latestPositionData.battery_level) : undefined,
            address: latestPositionData.address,
          };
        }

        return {
          id: vehicle.id,
          license_plate: vehicle.license_plate,
          brand: vehicle.brand,
          model: vehicle.model,
          type: vehicle.type,
          status: vehicle.status,
          latest_position,
          notes: vehicle.notes,
          created_at: vehicle.created_at,
          updated_at: vehicle.updated_at,
        };
      }) || [];

      // Transform positions data
      const transformedPositions: VehiclePosition[] = positionsData?.map(pos => ({
        vehicle_id: pos.vehicle_id,
        latitude: Number(pos.latitude),
        longitude: Number(pos.longitude),
        speed: Number(pos.speed || 0),
        heading: Number(pos.heading || 0),
        timestamp: pos.timestamp,
        ignition_status: pos.ignition_status || false,
        fuel_level: pos.fuel_level ? Number(pos.fuel_level) : undefined,
        engine_temperature: pos.engine_temperature ? Number(pos.engine_temperature) : undefined,
        battery_level: pos.battery_level ? Number(pos.battery_level) : undefined,
        address: pos.address,
      })) || [];

      setVehicles(transformedVehicles);
      setPositions(transformedPositions);
      setError(null);
    } catch (err) {
      console.error('Error fetching GPS51 data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Trigger GPS51 sync using the new configuration service
  const triggerSync = async () => {
    try {
      if (!gps51ConfigService.isConfigured()) {
        throw new Error('GPS51 is not configured. Please configure credentials first.');
      }

      setLoading(true);
      console.log('Triggering GPS51 sync...');
      
      const result = await gps51ConfigService.syncData();
      
      if (result.success) {
        console.log('GPS51 sync completed:', result);
        setLastSyncTime(new Date());
        
        // Refresh local data after successful sync
        setTimeout(fetchVehicleData, 2000);
        
        return result;
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error triggering GPS51 sync:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    fetchVehicleData();

    // Subscribe to vehicle changes
    const vehicleSubscription = supabase
      .channel('vehicles-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'vehicles' },
        () => {
          console.log('Vehicle data changed, refetching...');
          fetchVehicleData();
        }
      )
      .subscribe();

    // Subscribe to position changes
    const positionSubscription = supabase
      .channel('positions-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vehicle_positions' },
        (payload) => {
          console.log('New position data received:', payload);
          fetchVehicleData(); // Refresh all data when new positions arrive
        }
      )
      .subscribe();

    // Set up periodic sync every 2 minutes if configured
    let syncInterval: NodeJS.Timeout | null = null;
    if (gps51ConfigService.isConfigured()) {
      syncInterval = setInterval(() => {
        console.log('Triggering periodic GPS51 sync...');
        triggerSync().catch(err => console.error('Periodic sync failed:', err));
      }, 120000); // 2 minutes
    }

    return () => {
      supabase.removeChannel(vehicleSubscription);
      supabase.removeChannel(positionSubscription);
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, []);

  return {
    vehicles,
    positions,
    loading,
    error,
    lastSyncTime,
    refetch: fetchVehicleData,
    triggerSync,
    isConfigured: gps51ConfigService.isConfigured(),
  };
};
