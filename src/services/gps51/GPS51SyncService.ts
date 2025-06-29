
import { supabase } from '@/integrations/supabase/client';
import { gps51Client } from './GPS51Client';
import { GPS51AuthService } from '../gp51/GPS51AuthService';

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

      if (!this.authService.isAuthenticated()) {
        throw new Error('GPS51 not authenticated');
      }

      // Fetch devices from GPS51
      const devices = await gps51Client.getDeviceList();
      console.log(`Found ${devices.length} devices from GPS51`);

      // Fetch real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const positions = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`Found ${positions.length} positions from GPS51`);

      let vehiclesSynced = 0;
      let positionsStored = 0;

      // Process each device
      for (const device of devices) {
        try {
          // Store/update device
          const { error: deviceError } = await supabase
            .from('devices')
            .upsert({
              device_id: device.deviceid,
              device_name: device.devicename || device.deviceid,
              gps51_group_id: device.groupid?.toString(),
            }, {
              onConflict: 'device_id'
            });

          if (deviceError) {
            console.error('Error storing device:', deviceError);
            continue;
          }

          vehiclesSynced++;
        } catch (vehicleError) {
          console.error(`Error processing vehicle ${device.deviceid}:`, vehicleError);
          continue;
        }
      }

      // Store positions
      for (const position of positions) {
        try {
          const { error: positionError } = await supabase
            .from('positions')
            .upsert({
              device_id: position.deviceid,
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
        } catch (positionError) {
          console.error(`Error storing position for ${position.deviceid}:`, positionError);
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
      
      return {
        success: false,
        vehiclesSynced: 0,
        positionsStored: 0,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  async getStoredVehicles() {
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

  async getStoredPositions(deviceId?: string, limit = 100) {
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

    return data || [];
  }
}

export const gps51SyncService = new GPS51SyncService();
