
import { supabase } from '@/integrations/supabase/client';
import { GPS51Client } from '../gps51/GPS51Client';
import { gps51AuthService } from './GPS51AuthService';
import { GPS51Credentials, SyncResult } from './types';

export class GPS51ConfigService {
  private gps51Client: GPS51Client;

  constructor() {
    this.gps51Client = new GPS51Client();
  }

  async isConfigured(): Promise<boolean> {
    try {
      const session = JSON.parse(localStorage.getItem('gps51_session') || '{}');
      return !!(session.user_data?.username && session.user_data?.password && session.user_data?.apiUrl);
    } catch {
      return false;
    }
  }

  async getConfig(): Promise<GPS51Credentials | null> {
    try {
      const session = JSON.parse(localStorage.getItem('gps51_session') || '{}');
      if (session.user_data) {
        return {
          username: session.user_data.username,
          password: session.user_data.password,
          from: session.user_data.from || 'WEB',
          type: session.user_data.type || 'USER',
          apiUrl: session.user_data.apiUrl
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async saveConfig(credentials: GPS51Credentials): Promise<boolean> {
    try {
      const result = await gps51AuthService.authenticate(credentials);
      return result.success;
    } catch (error) {
      console.error('Failed to save GPS51 config:', error);
      return false;
    }
  }

  async syncData(): Promise<SyncResult> {
    try {
      console.log('GPS51ConfigService: Starting data sync...');
      
      const config = await this.getConfig();
      if (!config) {
        throw new Error('GPS51 not configured');
      }

      // Authenticate if not already authenticated
      if (!this.gps51Client.isAuthenticated()) {
        const authResult = await this.gps51Client.authenticate(config);
        if (!authResult.success) {
          throw new Error(authResult.error || 'Authentication failed');
        }
      }

      // Get device list
      const devices = await this.gps51Client.getDeviceList();
      console.log(`Found ${devices.length} GPS51 devices`);

      if (devices.length === 0) {
        return {
          success: true,
          vehiclesSynced: 0,
          positionsStored: 0
        };
      }

      // Get real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const positions = await this.gps51Client.getRealtimePositions(deviceIds);
      console.log(`Retrieved ${positions.length} positions`);

      // Store vehicles in Supabase
      let vehiclesSynced = 0;
      let positionsStored = 0;

      for (const device of devices) {
        try {
          // Upsert vehicle
          const vehicleData = {
            license_plate: device.devicename || device.deviceid,
            brand: 'GPS51',
            model: 'Device',
            type: 'other' as const,
            status: 'available' as const,
            gps51_device_id: device.deviceid,
            notes: `Last active: ${new Date(device.lastactivetime).toLocaleString()}`
          };

          const { error: vehicleError } = await supabase
            .from('vehicles')
            .upsert(vehicleData, {
              onConflict: 'gps51_device_id',
              ignoreDuplicates: false
            });

          if (vehicleError) {
            console.error('Error upserting vehicle:', vehicleError);
            continue;
          }

          vehiclesSynced++;

          // Find corresponding position
          const position = positions.find(p => p.deviceid === device.deviceid);
          if (position) {
            // Get vehicle ID
            const { data: vehicle } = await supabase
              .from('vehicles')
              .select('id')
              .eq('gps51_device_id', device.deviceid)
              .single();

            if (vehicle) {
              // Insert position
              const positionData = {
                vehicle_id: vehicle.id,
                latitude: position.callat,
                longitude: position.callon,
                speed: position.speed,
                heading: position.course,
                altitude: position.altitude,
                accuracy: position.radius,
                timestamp: new Date(position.updatetime).toISOString(),
                ignition_status: position.moving === 1,
                fuel_level: position.fuel,
                engine_temperature: position.temp1 ? position.temp1 / 10 : null,
                battery_level: position.voltage,
                address: position.strstatus,
                recorded_at: new Date().toISOString()
              };

              const { error: positionError } = await supabase
                .from('vehicle_positions')
                .insert(positionData);

              if (!positionError) {
                positionsStored++;
              } else {
                console.error('Error inserting position:', positionError);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing device ${device.deviceid}:`, error);
        }
      }

      console.log(`GPS51 sync completed: ${vehiclesSynced} vehicles, ${positionsStored} positions`);

      return {
        success: true,
        vehiclesSynced,
        positionsStored
      };

    } catch (error) {
      console.error('GPS51ConfigService: Sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  async initializeFromAuth(): Promise<void> {
    // This method can be used to initialize GPS51 config from stored auth data
    const config = await this.getConfig();
    if (config && !this.gps51Client.isAuthenticated()) {
      try {
        await this.gps51Client.authenticate(config);
      } catch (error) {
        console.warn('Failed to initialize GPS51 from stored auth:', error);
      }
    }
  }
}

export const gps51ConfigService = new GPS51ConfigService();
