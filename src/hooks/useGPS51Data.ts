
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Define raw GPS51 position data type as per API document
interface GPS51PositionRaw {
  deviceid: string;
  callat: number; // Latitude
  callon: number; // Longitude
  updatetime: number; // UTC format, long (timestamp in milliseconds)
  validpoistiontime: number; // Last valid location time, UTC format, long
  radius: number; // Accuracy radius, meter
  speed: number; // Speed, m/h
  altitude: number; // Altitude, meter
  course: number; // Direction, 0~360 degree
  totaldistance: number; // Total mileage, meter
  status: number; // Status code
  strstatus: string; // Status description
  alarm: number; // Alarm code
  stralarm: string; // Alarm description
  gotsrc: string; // Location type (LBS, wifi, gps)
  rxlevel: number; // Signal percentage
  voltagev?: number; // Voltage, V, some device don't have voltage.
  voltagepercent?: number; // Volume percentage
  gpsvalidnum?: number; // Satellite numbers
  iostatus?: number; // I/O Status
  rotatestatus?: number; // Rotation sensor
  reportmode?: number; // Upload mode
  moving: number; // 0: stop, 1: moving
  parkduration?: number; // Parking duration, ms
  temp1?: number; // Temperature 1, 1/10 degree C
}

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

// Define the VehicleData type - updated to include all vehicle types
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

// Define the raw Supabase vehicle row type
interface SupabaseVehicleRow {
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
  vehicle_positions: GPS51PositionRaw[] | GPS51PositionRaw | null;
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
        .order('updated_at', { ascending: false }) as { data: SupabaseVehicleRow[] | null, error: any };

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
              new Date(b.updatetime).getTime() - new Date(a.updatetime).getTime()
            )[0];
          } else if (vehicle.vehicle_positions && !Array.isArray(vehicle.vehicle_positions)) {
            latestPositionRaw = vehicle.vehicle_positions;
          }

          let latestPosition: VehiclePosition | null = null;
          if (latestPositionRaw) {
            latestPosition = {
              vehicle_id: vehicle.id,
              latitude: Number(latestPositionRaw.callat),
              longitude: Number(latestPositionRaw.callon),
              speed: Number(latestPositionRaw.speed || 0),
              timestamp: new Date(latestPositionRaw.updatetime).toISOString(),
              status: latestPositionRaw.strstatus || 'Unknown location',
              isMoving: latestPositionRaw.moving === 1,
              ignition_status: latestPositionRaw.moving === 1,
              heading: latestPositionRaw.course ? Number(latestPositionRaw.course) : undefined,
              fuel_level: latestPositionRaw.voltagepercent ? Number(latestPositionRaw.voltagepercent) : undefined,
              engine_temperature: latestPositionRaw.temp1 ? Number(latestPositionRaw.temp1) / 10 : undefined,
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
