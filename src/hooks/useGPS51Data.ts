
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
}

// Define the VehicleData type
export interface VehicleData {
  id: string;
  brand: string;
  model: string;
  license_plate: string;
  status: 'inactive' | 'available' | 'assigned' | 'maintenance';
  type: 'sedan' | 'truck' | 'van' | 'motorcycle' | 'other';
  created_at: string;
  updated_at: string;
  notes: string;
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

      // Fetch vehicles with their latest positions
      const { data: vehiclesRaw, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!inner(
            vehicle_id, latitude, longitude, speed, timestamp, address, ignition_status
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      if (vehiclesRaw) {
        const transformedVehicles: VehicleData[] = vehiclesRaw.map(vehicle => {
          // Get the latest position (assuming sorted by timestamp)
          const rawLatestPosition = Array.isArray(vehicle.vehicle_positions) 
            ? vehicle.vehicle_positions[0] 
            : vehicle.vehicle_positions;

          let latestPosition: VehiclePosition | null = null;
          if (rawLatestPosition) {
            latestPosition = {
              vehicle_id: vehicle.id,
              latitude: Number(rawLatestPosition.latitude),
              longitude: Number(rawLatestPosition.longitude),
              speed: Number(rawLatestPosition.speed || 0),
              timestamp: rawLatestPosition.timestamp,
              status: rawLatestPosition.address || 'Unknown',
              isMoving: rawLatestPosition.ignition_status || false,
            };
          }

          return {
            id: vehicle.id,
            brand: vehicle.brand || 'Unknown',
            model: vehicle.model || 'Unknown',
            license_plate: vehicle.license_plate,
            status: vehicle.status,
            type: vehicle.type,
            created_at: vehicle.created_at,
            updated_at: vehicle.updated_at,
            notes: vehicle.notes || '',
            latest_position: latestPosition,
          };
        });

        setVehicles(transformedVehicles);
        
        // Extract all positions
        const allPositions: VehiclePosition[] = transformedVehicles
          .filter(v => v.latest_position !== null)
          .map(v => v.latest_position as VehiclePosition);
        
        setVehiclePositions(allPositions);
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
