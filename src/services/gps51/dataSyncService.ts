
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
            license_plate: device.devicename,
            gps51_device_id: device.deviceid,
            brand: 'GPS51',
            model: `Device ${device.devicetype}`,
            type: GPS51DeviceTypeMapper.mapDeviceTypeToVehicleType(device.devicetype),
            status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
            notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}`,
            updated_at: new Date().toISOString()
          };

          console.log(`GPS51DataSyncService: Syncing vehicle: ${device.devicename} with GPS51 ID: ${device.deviceid}`);

          const { data: vehicleResult, error } = await supabase
            .from('vehicles')
            .upsert(vehicleData, {
              onConflict: 'license_plate'
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

          // Find vehicle by GPS51 device ID instead of license plate
          const { data: vehicle, error: vehicleQueryError } = await supabase
            .from('vehicles')
            .select('id')
            .eq('gps51_device_id', position.deviceid)
            .single();

          if (vehicleQueryError) {
            console.warn(`GPS51DataSyncService: Error finding vehicle for device ${position.deviceid}:`, vehicleQueryError);
            continue;
          }

          if (vehicle) {
            const positionData = {
              vehicle_id: vehicle.id,
              device_id: position.deviceid,
              latitude: position.callat,
              longitude: position.callon,
              speed: position.speed,
              heading: position.course,
              altitude: position.altitude,
              timestamp: new Date(position.updatetime).toISOString(),
              ignition_status: position.moving === 1,
              fuel_level: position.voltagepercent,
              engine_temperature: position.temp1,
              battery_level: position.voltage,
              address: position.strstatus
            };

            console.log(`GPS51DataSyncService: Storing position for vehicle ${vehicle.id}:`, {
              deviceId: position.deviceid,
              lat: position.callat,
              lon: position.callon,
              speed: position.speed,
              moving: position.moving
            });

            const { error } = await supabase
              .from('vehicle_positions')
              .insert(positionData);

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
