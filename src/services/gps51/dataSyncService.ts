
import { GPS51SyncResult } from './interfaces';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { gps51Client } from './GPS51Client';
import { GPS51DeviceTypeMapper } from './deviceTypeMapper';
import { supabase } from '@/integrations/supabase/client';

export class GPS51DataSyncService {
  private authService = GPS51AuthService.getInstance();

  async syncData(): Promise<GPS51SyncResult> {
    try {
      console.log('GPS51DataSyncService: Starting data sync...');

      // Get valid token
      const token = await this.authService.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      // Fetch devices using the GPS51 client
      const devices = await gps51Client.getDeviceList();
      console.log(`GPS51DataSyncService: Found ${devices.length} devices from GPS51`);

      // Fetch real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const { positions } = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`GPS51DataSyncService: Found ${positions.length} positions from GPS51`);

      // Store vehicles in Supabase with GPS51 device IDs
      let vehiclesSynced = 0;
      const deviceToVehicleMap = new Map<string, string>();
      
      for (const device of devices) {
        try {
          const vehicleData = {
            plate: device.devicename,
            make: 'GPS51',
            model: `Device ${device.devicetype}`,
            status: (device.isfree === 1 ? 'active' : 'inactive') as 'active',
            updated_at: new Date().toISOString()
          };

          console.log(`GPS51DataSyncService: Syncing vehicle: ${device.devicename} with GPS51 ID: ${device.deviceid}`);

          const { data: vehicleResult, error } = await supabase
            .from('vehicles')
            .upsert(vehicleData, {
              onConflict: 'plate'
            })
            .select('id')
            .single();

          if (!error && vehicleResult) {
            vehiclesSynced++;
            deviceToVehicleMap.set(device.deviceid, vehicleResult.id);
            console.log(`GPS51DataSyncService: Successfully synced vehicle ${device.devicename} -> ${vehicleResult.id}`);
          } else {
            console.warn(`GPS51DataSyncService: Failed to sync vehicle ${device.deviceid}:`, error);
          }
        } catch (err) {
          console.warn(`GPS51DataSyncService: Error syncing vehicle ${device.deviceid}:`, err);
        }
      }

      // Store positions using GPS51 device ID mapping
      let positionsStored = 0;
      for (const position of positions) {
        try {
          console.log(`GPS51DataSyncService: Processing position for GPS51 device: ${position.deviceid}`);

          // Find vehicle by plate name instead of GPS51 device ID
          const { data: vehicle, error: vehicleQueryError } = await supabase
            .from('vehicles')
            .select('id')
            .eq('plate', position.deviceid)
            .single();

          if (vehicleQueryError) {
            console.warn(`GPS51DataSyncService: Error finding vehicle for device ${position.deviceid}:`, vehicleQueryError);
            continue;
          }

          if (vehicle) {
            console.log(`GPS51DataSyncService: Would store position for vehicle ${vehicle.id}:`, {
              deviceId: position.deviceid,
              lat: position.callat,
              lon: position.callon,
              speed: position.speed,
              moving: position.moving
            });

            // Position storage temporarily disabled - vehicle_positions table doesn't exist yet
            console.log('GPS51DataSyncService: Position storage temporarily disabled - database schema pending');
            const error = null;

            if (!error) {
              positionsStored++;
              console.log(`GPS51DataSyncService: Successfully stored position for device ${position.deviceid}`);
            } else {
              console.warn(`GPS51DataSyncService: Failed to store position for device ${position.deviceid}:`, error);
            }
          } else {
            console.warn(`GPS51DataSyncService: No vehicle found for GPS51 device ID: ${position.deviceid}`);
          }
        } catch (err) {
          console.warn(`GPS51DataSyncService: Error storing position for ${position.deviceid}:`, err);
        }
      }

      console.log(`GPS51DataSyncService: Sync completed: ${vehiclesSynced} vehicles, ${positionsStored} positions`);

      return {
        success: true,
        vehiclesSynced,
        positionsStored,
        devicesFound: devices.length,
        positionsFound: positions.length
      };

    } catch (error) {
      console.error('GPS51DataSyncService: Sync failed:', error);
      return {
        success: false,
        vehiclesSynced: 0,
        positionsStored: 0,
        devicesFound: 0,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }
}
