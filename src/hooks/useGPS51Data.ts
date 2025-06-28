
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
      
      // Fetch vehicles with their latest positions using a JOIN query
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!inner(
            vehicle_id,
            latitude,
            longitude,
            speed,
            heading,
            timestamp,
            ignition_status,
            fuel_level,
            engine_temperature
          )
        `)
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      // Transform the data to match our interface
      const transformedVehicles: VehicleData[] = vehiclesData?.map(vehicle => {
        // Get the latest position (assuming they're ordered by timestamp DESC in the query)
        const latestPositionData = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions[0] 
          : vehicle.vehicle_positions;

        let latest_position: VehiclePosition | undefined;
        if (latestPositionData) {
          latest_position = {
            vehicle_id: vehicle.id,
            latitude: parseFloat(latestPositionData.latitude),
            longitude: parseFloat(latestPositionData.longitude),
            speed: parseFloat(latestPositionData.speed || '0'),
            heading: parseFloat(latestPositionData.heading || '0'),
            timestamp: latestPositionData.timestamp,
            ignition_status: latestPositionData.ignition_status || false,
            fuel_level: latestPositionData.fuel_level ? parseFloat(latestPositionData.fuel_level) : undefined,
            engine_temperature: latestPositionData.engine_temperature ? parseFloat(latestPositionData.engine_temperature) : undefined,
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

      // Also fetch all recent positions for the positions array
      const { data: positionsData, error: positionsError } = await supabase
        .from('vehicle_positions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!positionsError && positionsData) {
        const transformedPositions: VehiclePosition[] = positionsData.map(pos => ({
          vehicle_id: pos.vehicle_id,
          latitude: parseFloat(pos.latitude),
          longitude: parseFloat(pos.longitude),
          speed: parseFloat(pos.speed || '0'),
          heading: parseFloat(pos.heading || '0'),
          timestamp: pos.timestamp,
          ignition_status: pos.ignition_status || false,
          fuel_level: pos.fuel_level ? parseFloat(pos.fuel_level) : undefined,
          engine_temperature: pos.engine_temperature ? parseFloat(pos.engine_temperature) : undefined,
        }));
        setPositions(transformedPositions);
      }

      setVehicles(transformedVehicles);
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
      const { data, error } = await supabase.functions.invoke('gps51-sync');
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
