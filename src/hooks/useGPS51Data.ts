
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
  status: string;
  type: string;
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

      console.log('Fetching vehicles with LEFT JOIN...');

      // Fetch ALL vehicles with their latest positions using LEFT JOIN
      const { data: vehiclesRaw, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!left(
            vehicle_id, latitude, longitude, speed, timestamp, address, ignition_status, heading, fuel_level, engine_temperature
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) {
        console.error('Error fetching vehicles:', vehiclesError);
        throw vehiclesError;
      }

      console.log('Raw vehicles data:', vehiclesRaw?.length || 0, 'vehicles found');

      if (vehiclesRaw) {
        const transformedVehicles: VehicleData[] = vehiclesRaw.map(vehicle => {
          console.log(`Processing vehicle: ${vehicle.license_plate}, positions:`, vehicle.vehicle_positions);
          
          // Handle both array and single position data, get the most recent
          let latestPositionRaw = null;
          if (Array.isArray(vehicle.vehicle_positions) && vehicle.vehicle_positions.length > 0) {
            // Sort by timestamp to get the latest
            latestPositionRaw = vehicle.vehicle_positions.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0];
          } else if (vehicle.vehicle_positions && !Array.isArray(vehicle.vehicle_positions)) {
            latestPositionRaw = vehicle.vehicle_positions;
          }

          let latestPosition: VehiclePosition | null = null;
          if (latestPositionRaw) {
            latestPosition = {
              vehicle_id: vehicle.id,
              latitude: Number(latestPositionRaw.latitude),
              longitude: Number(latestPositionRaw.longitude),
              speed: Number(latestPositionRaw.speed || 0),
              timestamp: latestPositionRaw.timestamp,
              status: latestPositionRaw.address || 'Unknown location',
              isMoving: latestPositionRaw.ignition_status || false,
              ignition_status: latestPositionRaw.ignition_status || false,
              heading: latestPositionRaw.heading ? Number(latestPositionRaw.heading) : undefined,
              fuel_level: latestPositionRaw.fuel_level ? Number(latestPositionRaw.fuel_level) : undefined,
              engine_temperature: latestPositionRaw.engine_temperature ? Number(latestPositionRaw.engine_temperature) : undefined,
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
            gps51_device_id: vehicle.gps51_device_id,
            latest_position: latestPosition,
          };
        });

        console.log('Transformed vehicles:', transformedVehicles.length, 'total');
        console.log('Vehicles with positions:', transformedVehicles.filter(v => v.latest_position).length);

        setVehicles(transformedVehicles);
        
        // Extract all positions for the separate positions array
        const allPositions: VehiclePosition[] = transformedVehicles
          .filter(v => v.latest_position !== null)
          .map(v => v.latest_position as VehiclePosition);
        
        setVehiclePositions(allPositions);
        console.log('Vehicle positions extracted:', allPositions.length);
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
