
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

interface VehicleData {
  id: string;
  license_plate: string;
  brand?: string;
  model?: string;
  type: string;
  status: string;
  latest_position?: VehiclePosition;
}

export const useGPS51Data = () => {
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [positions, setPositions] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Trigger GPS51 sync
  const triggerSync = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          apiUrl: 'https://api.gps51.com', // Default API URL
          accessToken: 'demo-token' // This should come from authentication
        }
      });
      
      if (error) throw error;
      
      console.log('GPS51 sync triggered:', data);
      
      // Refresh data after sync
      setTimeout(fetchVehicleData, 2000);
      
      return data;
    } catch (err) {
      console.error('Error triggering GPS51 sync:', err);
      throw err;
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

    // Set up periodic sync every 30 seconds
    const syncInterval = setInterval(() => {
      console.log('Triggering periodic GPS51 sync...');
      triggerSync().catch(err => console.error('Periodic sync failed:', err));
    }, 30000);

    return () => {
      supabase.removeChannel(vehicleSubscription);
      supabase.removeChannel(positionSubscription);
      clearInterval(syncInterval);
    };
  }, []);

  return {
    vehicles,
    positions,
    loading,
    error,
    refetch: fetchVehicleData,
    triggerSync,
  };
};
