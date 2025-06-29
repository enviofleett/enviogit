
import { supabase } from '@/integrations/supabase/client';
import { gps51Client } from './GPS51Client';
import { GPS51AuthService } from './GPS51AuthService';
import type { GPS51Device, GPS51Position } from '@/integrations/supabase/types';

export interface SyncResult {
  success: boolean;
  vehiclesSynced: number;
  positionsStored: number;
  error?: string;
}

export class GPS51SyncService {
  private authService: GPS51AuthService;

  constructor() {
    this.authService = GPS51AuthService.getInstance();
  }

  async syncVehicleData(): Promise<SyncResult> {
    try {
      console.log('Starting GPS51 vehicle data sync...');

      if (!this.authService.isAuthenticatedState()) {
        throw new Error('GPS51 not authenticated');
      }

      // Fetch vehicles from GPS51
      const vehiclesResponse = await gps51Client.getVehicles();
      if (!vehiclesResponse.success) {
        throw new Error(vehiclesResponse.error || 'Failed to fetch vehicles');
      }

      const vehicles = vehiclesResponse.data || [];
      let vehiclesSynced = 0;
      let positionsStored = 0;

      // Process each vehicle
      for (const vehicle of vehicles) {
        try {
          // Store/update device
          const { error: deviceError } = await supabase
            .from('devices')
            .upsert({
              device_id: vehicle.deviceid,
              device_name: vehicle.devicename || vehicle.deviceid,
              gps51_group_id: vehicle.groupid?.toString(),
            }, {
              onConflict: 'device_id'
            });

          if (deviceError) {
            console.error('Error storing device:', deviceError);
            continue;
          }

          // Get latest positions for this vehicle
          const positionsResponse = await gps51Client.getPositions(vehicle.deviceid);
          if (positionsResponse.success && positionsResponse.data) {
            const positions = Array.isArray(positionsResponse.data) 
              ? positionsResponse.data 
              : [positionsResponse.data];

            for (const position of positions) {
              const { error: positionError } = await supabase
                .from('positions')
                .upsert({
                  device_id: vehicle.deviceid,
                  latitude: position.callat,
                  longitude: position.callon,
                  timestamp: new Date(position.updatetime).toISOString(),
                  speed_kph: position.speed || 0,
                  heading: position.course || 0,
                  ignition_on: position.moving === 1,
                  battery_voltage: position.voltage,
                  raw_data: position
                }, {
                  onConflict: 'device_id,timestamp'
                });

              if (!positionError) {
                positionsStored++;
              }
            }
          }

          vehiclesSynced++;
        } catch (vehicleError) {
          console.error(`Error processing vehicle ${vehicle.deviceid}:`, vehicleError);
          continue;
        }
      }

      console.log(`GPS51 sync completed: ${vehiclesSynced} vehicles, ${positionsStored} positions`);
      
      return {
        success: true,
        vehiclesSynced,
        positionsStored
      };

    } catch (error) {
      console.error('GPS51 sync failed:', error);
      
      if (!this.authService.isAuthenticatedState()) {
        return {
          success: false,
          vehiclesSynced: 0,
          positionsStored: 0,
          error: 'Authentication required'
        };
      }

      return {
        success: false,
        vehiclesSynced: 0,
        positionsStored: 0,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  async getStoredVehicles(): Promise<GPS51Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('device_name');

    if (error) {
      console.error('Error fetching stored vehicles:', error);
      return [];
    }

    return data || [];
  }

  async getStoredPositions(deviceId?: string, limit = 100): Promise<GPS51Position[]> {
    let query = supabase
      .from('positions')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching stored positions:', error);
      return [];
    }

    return data?.map(position => ({
      deviceid: position.device_id || '',
      callat: position.latitude,
      callon: position.longitude,
      updatetime: new Date(position.timestamp).getTime(),
      speed: position.speed_kph || 0,
      moving: position.ignition_on ? 1 : 0,
      strstatus: 'Stored Position',
      totaldistance: 0,
      course: position.heading || 0,
      altitude: 0,
      radius: 0,
      voltage: position.battery_voltage
    })) || [];
  }
}

export const gps51SyncService = new GPS51SyncService();
