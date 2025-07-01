
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { GPS51Device, GPS51Position } from './types.ts';

export class GPS51DataProcessor {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async syncVehicles(devices: GPS51Device[]): Promise<{ synced: number; errors: string[] }> {
    console.log("=== SYNCING VEHICLES ===");
    
    let vehiclesSynced = 0;
    const syncErrors: string[] = [];
    
    for (const device of devices) {
      try {
        const vehicleData = {
          license_plate: device.devicename,
          gps51_device_id: device.deviceid,
          brand: 'GPS51',
          model: `Device ${device.devicetype}`,
          type: this.mapDeviceTypeToVehicleType(device.devicetype),
          status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
          notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}, Last Active: ${new Date(device.lastactivetime).toISOString()}`,
          updated_at: new Date().toISOString(),
        };

        console.log(`Syncing vehicle: ${device.devicename} (${device.deviceid})`);

        const { data: vehicleResult, error: vehicleError } = await this.supabase
          .from('vehicles')
          .upsert(vehicleData, { onConflict: 'license_plate' })
          .select('id')
          .single();

        if (!vehicleError && vehicleResult) {
          vehiclesSynced++;
          console.log(`✅ Vehicle synced: ${device.devicename} -> DB ID: ${vehicleResult.id}`);
        } else {
          const errorMsg = `Vehicle sync failed for ${device.deviceid}: ${vehicleError?.message || 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          syncErrors.push(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Exception syncing vehicle ${device.deviceid}: ${err}`;
        console.error(`❌ ${errorMsg}`);
        syncErrors.push(errorMsg);
      }
    }

    console.log(`Vehicle Sync Summary: ${vehiclesSynced}/${devices.length} vehicles synced successfully`);
    return { synced: vehiclesSynced, errors: syncErrors };
  }

  async storePositions(positions: GPS51Position[]): Promise<{ stored: number; errors: string[]; skipped: string[] }> {
    console.log("=== STORING POSITIONS ===");
    console.log(`Processing ${positions.length} positions...`);

    let positionsStored = 0;
    const storageErrors: string[] = [];
    const skippedPositions: string[] = [];

    for (const position of positions) {
      try {
        console.log(`Processing position for device: ${position.deviceid}`);

        // Enhanced validation for position data
        if (!position.deviceid || typeof position.callat !== 'number' || typeof position.callon !== 'number') {
          const skipMsg = `Invalid position data for ${position.deviceid}: lat=${position.callat}, lon=${position.callon}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Validate coordinates are within reasonable bounds
        if (Math.abs(position.callat) > 90 || Math.abs(position.callon) > 180) {
          const skipMsg = `Invalid coordinates for ${position.deviceid}: lat=${position.callat}, lon=${position.callon}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Find vehicle by GPS51 device ID
        const { data: vehicle, error: vehicleQueryError } = await this.supabase
          .from('vehicles')
          .select('id, license_plate')
          .eq('gps51_device_id', position.deviceid)
          .single();

        if (vehicleQueryError || !vehicle) {
          const skipMsg = `Vehicle not found for GPS51 device ${position.deviceid}: ${vehicleQueryError?.message || 'No matching vehicle'}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        // Validate timestamp
        const positionTimestamp = new Date(position.updatetime);
        if (isNaN(positionTimestamp.getTime())) {
          const skipMsg = `Invalid timestamp for ${position.deviceid}: ${position.updatetime}`;
          console.warn(`⚠️ ${skipMsg}`);
          skippedPositions.push(skipMsg);
          continue;
        }

        const positionData = {
          vehicle_id: vehicle.id,
          latitude: Number(position.callat),
          longitude: Number(position.callon),
          speed: Number(position.speed || 0),
          heading: Number(position.course || 0),
          timestamp: positionTimestamp.toISOString(),
          ignition_status: position.moving === 1,
          fuel_level: position.voltagepercent ? Number(position.voltagepercent) : null,
          engine_temperature: position.temp1 ? Number(position.temp1) : null,
          address: position.strstatus || null,
          recorded_at: new Date().toISOString()
        };

        console.log(`Storing position for vehicle ${vehicle.license_plate} (${vehicle.id}):`, {
          deviceId: position.deviceid,
          lat: positionData.latitude,
          lon: positionData.longitude,
          speed: positionData.speed,
          timestamp: positionData.timestamp,
          ignition: positionData.ignition_status
        });

        const { error: positionError } = await this.supabase
          .from('vehicle_positions')
          .upsert(positionData, { 
            onConflict: 'vehicle_id,timestamp',
            ignoreDuplicates: false 
          });

        if (!positionError) {
          positionsStored++;
          console.log(`✅ Position stored for ${position.deviceid} -> ${vehicle.license_plate}`);
        } else {
          const errorMsg = `Position storage failed for ${position.deviceid}: ${positionError.message}`;
          console.error(`❌ ${errorMsg}`);
          storageErrors.push(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Exception storing position for ${position.deviceid}: ${err}`;
        console.error(`❌ ${errorMsg}`);
        storageErrors.push(errorMsg);
      }
    }

    return { stored: positionsStored, errors: storageErrors, skipped: skippedPositions };
  }

  private mapDeviceTypeToVehicleType(deviceType: number): 'sedan' | 'truck' | 'van' | 'motorcycle' | 'bike' | 'other' {
    switch (deviceType) {
      case 1:
      case 2:
        return 'sedan';
      case 3:
      case 4:
        return 'truck';
      case 5:
        return 'van';
      case 6:
        return 'motorcycle';
      case 7:
        return 'bike';
      default:
        return 'other';
    }
  }

  async filterDevicesByPriority(devices: GPS51Device[], priority: number): Promise<GPS51Device[]> {
    console.log(`=== BATCH MODE: FILTERING BY PRIORITY ${priority} ===`);
    
    // Get vehicle data from database to determine priorities
    const { data: dbVehicles, error: dbError } = await this.supabase
      .from('vehicles')
      .select(`
        gps51_device_id,
        status,
        updated_at,
        vehicle_positions!left(
          timestamp,
          ignition_status,
          speed
        )
      `);

    if (dbError) {
      console.error('Error fetching vehicles for priority filtering:', dbError);
      return devices; // Return all devices if filtering fails
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const priorityDeviceIds = new Set<string>();

    dbVehicles?.forEach(vehicle => {
      if (!vehicle.gps51_device_id) return;

      const latestPosition = Array.isArray(vehicle.vehicle_positions) 
        ? vehicle.vehicle_positions.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0]
        : vehicle.vehicle_positions;

      const lastPositionTime = latestPosition ? new Date(latestPosition.timestamp) : null;
      const isRecentlyActive = lastPositionTime && lastPositionTime > oneHourAgo;
      const isMoving = latestPosition?.ignition_status || (latestPosition?.speed || 0) > 0;
      const hasRecentPosition = lastPositionTime && lastPositionTime > oneDayAgo;

      let vehiclePriority = 4; // Default to inactive

      if (isRecentlyActive && isMoving) {
        vehiclePriority = 1; // Active/Moving
      } else if (vehicle.status === 'assigned' && hasRecentPosition) {
        vehiclePriority = 2; // Assigned with recent activity
      } else if (vehicle.status === 'available' && hasRecentPosition) {
        vehiclePriority = 3; // Available with recent activity
      }

      if (vehiclePriority === priority) {
        priorityDeviceIds.add(vehicle.gps51_device_id);
      }
    });

    // Filter devices by priority
    const filteredDevices = devices.filter(device => priorityDeviceIds.has(device.deviceid));

    console.log(`Priority ${priority} filtering result:`, {
      originalDeviceCount: devices.length,
      filteredDeviceCount: filteredDevices.length,
      priorityDeviceIds: Array.from(priorityDeviceIds).slice(0, 5)
    });

    return filteredDevices;
  }
}
