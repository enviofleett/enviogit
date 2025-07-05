
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Define the VehiclePosition type
export interface VehiclePosition {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;
  status: string;
  isMoving: boolean;
  ignition_status?: boolean;
  heading?: number;
  fuel_level?: number;
  engine_temperature?: number;
}

// Define the VehicleData type - updated to include 'bike'
export interface VehicleData {
  id: string;
  brand: string;
  model: string;
  license_plate: string;
  status: 'inactive' | 'available' | 'assigned' | 'maintenance';
  type: 'bike' | 'sedan' | 'truck' | 'van' | 'motorcycle' | 'other';
  created_at: string;
  updated_at: string;
  notes: string;
  gps51_device_id?: string;
  latest_position: VehiclePosition | null;
}

export const useGPS51Data = () => {
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [vehiclePositions, setVehiclePositions] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching vehicles from current schema...');

      // Fetch vehicles using current schema
      const { data: vehiclesRaw, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        throw vehiclesError;
      }

      console.log('Raw vehicles data:', vehiclesRaw?.length || 0, 'vehicles found');

      if (vehiclesRaw) {
        const transformedVehicles: VehicleData[] = vehiclesRaw.map(vehicle => {
          // Map current schema to expected interface
          const status = ['inactive', 'available', 'assigned', 'maintenance'].includes(vehicle.status) 
            ? vehicle.status as 'inactive' | 'available' | 'assigned' | 'maintenance'
            : 'inactive';

          return {
            id: vehicle.id,
            brand: vehicle.make || 'Unknown',
            model: vehicle.model || 'Unknown',
            license_plate: vehicle.plate || '',
            status,
            type: 'sedan' as const, // Default type since not in current schema
            created_at: vehicle.created_at,
            updated_at: vehicle.updated_at,
            notes: '',
            gps51_device_id: undefined,
            latest_position: null, // No positions table yet
          };
        });

        console.log('Transformed vehicles:', transformedVehicles.length, 'total');

        setVehicles(transformedVehicles);
        setVehiclePositions([]); // Empty until positions table exists
      }
    } catch (err) {
      console.error('Error fetching vehicle data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicleData();
  }, [fetchVehicleData]);

  const refresh = useCallback(() => {
    console.log('Manually refreshing vehicle data...');
    fetchVehicleData();
  }, [fetchVehicleData]);

  return {
    vehicles,
    vehiclePositions,
    loading,
    error,
    refresh
  };
};
