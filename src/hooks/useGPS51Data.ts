
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
      
      // Fetch vehicles from existing table
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      // Since vehicle_positions table doesn't exist yet, we'll use mock data
      // This will be replaced once we create the proper table structure
      const vehiclesWithPositions = vehiclesData?.map(vehicle => ({
        id: vehicle.id,
        license_plate: vehicle.license_plate,
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        status: vehicle.status,
        latest_position: undefined, // Will be populated after SQL migration
      })) || [];

      setVehicles(vehiclesWithPositions);
      setPositions([]); // Empty until we have the proper table
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
        () => fetchVehicleData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(vehicleSubscription);
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
