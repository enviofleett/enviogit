
import { GPS51AuthService, GPS51Credentials } from './GPS51AuthService';
import { gps51Client } from '../gps51/GPS51Client';
import { supabase } from '@/integrations/supabase/client';

export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  apiKey?: string;
  from?: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type?: 'USER' | 'DEVICE';
}

export interface GPS51SyncResult {
  success: boolean;
  vehiclesSynced: number;
  positionsStored: number;
  devicesFound: number;
  error?: string;
}

export class GPS51ConfigService {
  private static instance: GPS51ConfigService;
  private authService = GPS51AuthService.getInstance();

  static getInstance(): GPS51ConfigService {
    if (!GPS51ConfigService.instance) {
      GPS51ConfigService.instance = new GPS51ConfigService();
    }
    return GPS51ConfigService.instance;
  }

  async saveConfiguration(config: GPS51Config): Promise<void> {
    try {
      // Store configuration in localStorage (without password)
      localStorage.setItem('gps51_api_url', config.apiUrl);
      localStorage.setItem('gps51_username', config.username);
      localStorage.setItem('gps51_from', config.from || 'WEB');
      localStorage.setItem('gps51_type', config.type || 'USER');

      if (config.apiKey) {
        localStorage.setItem('gps51_api_key', config.apiKey);
      }

      // Store credentials for auth service (without password for security)
      localStorage.setItem('gps51_credentials', JSON.stringify({
        username: config.username,
        apiUrl: config.apiUrl,
        from: config.from || 'WEB',
        type: config.type || 'USER'
      }));

      console.log('GPS51 configuration saved successfully');
    } catch (error) {
      console.error('Failed to save GPS51 configuration:', error);
      throw new Error('Failed to save configuration');
    }
  }

  getConfiguration(): GPS51Config | null {
    try {
      const apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const apiKey = localStorage.getItem('gps51_api_key');
      const from = localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
      const type = localStorage.getItem('gps51_type') as 'USER' | 'DEVICE';

      if (apiUrl && username) {
        return {
          apiUrl,
          username,
          password: '', // Never store passwords
          apiKey: apiKey || undefined,
          from: from || 'WEB',
          type: type || 'USER'
        };
      }
    } catch (error) {
      console.error('Failed to load GPS51 configuration:', error);
    }

    return null;
  }

  async testConnection(config: GPS51Config): Promise<boolean> {
    try {
      const credentials: GPS51Credentials = {
        username: config.username,
        password: config.password,
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        from: config.from || 'WEB',
        type: config.type || 'USER'
      };

      const token = await this.authService.authenticate(credentials);
      return !!token.access_token;
    } catch (error) {
      console.error('GPS51 connection test failed:', error);
      throw error;
    }
  }

  async syncData(): Promise<GPS51SyncResult> {
    try {
      console.log('Starting GPS51 data sync...');

      // Get valid token
      const token = await this.authService.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      // Fetch devices using the GPS51 client
      const devices = await gps51Client.getDeviceList();
      console.log(`Found ${devices.length} devices from GPS51`);

      // Fetch real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const positions = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`Found ${positions.length} positions from GPS51`);

      // Store vehicles in Supabase
      let vehiclesSynced = 0;
      for (const device of devices) {
        try {
          const vehicleData = {
            license_plate: device.devicename,
            brand: 'GPS51',
            model: `Device ${device.devicetype}`,
            type: this.mapDeviceTypeToVehicleType(device.devicetype),
            status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
            notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}`,
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('vehicles')
            .upsert(vehicleData, {
              onConflict: 'license_plate'
            });

          if (!error) {
            vehiclesSynced++;
          } else {
            console.warn(`Failed to sync vehicle ${device.deviceid}:`, error);
          }
        } catch (err) {
          console.warn(`Error syncing vehicle ${device.deviceid}:`, err);
        }
      }

      // Store positions in Supabase
      let positionsStored = 0;
      for (const position of positions) {
        try {
          // First, find the vehicle by device name/license plate
          const { data: vehicle } = await supabase
            .from('vehicles')
            .select('id')
            .eq('license_plate', position.deviceid)
            .single();

          if (vehicle) {
            const positionData = {
              vehicle_id: vehicle.id,
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
              address: position.strstatus,
              recorded_at: new Date().toISOString()
            };

            const { error } = await supabase
              .from('vehicle_positions')
              .insert(positionData);

            if (!error) {
              positionsStored++;
            } else {
              console.warn(`Failed to store position for ${position.deviceid}:`, error);
            }
          }
        } catch (err) {
          console.warn(`Error storing position for ${position.deviceid}:`, err);
        }
      }

      console.log(`GPS51 sync completed: ${vehiclesSynced} vehicles, ${positionsStored} positions`);

      return {
        success: true,
        vehiclesSynced,
        positionsStored,
        devicesFound: devices.length
      };

    } catch (error) {
      console.error('GPS51 sync failed:', error);
      return {
        success: false,
        vehiclesSynced: 0,
        positionsStored: 0,
        devicesFound: 0,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  private mapDeviceTypeToVehicleType(deviceType: number): 'sedan' | 'truck' | 'van' | 'motorcycle' | 'bike' | 'other' {
    // Map GPS51 device types to our vehicle types
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

  isConfigured(): boolean {
    const config = this.getConfiguration();
    return !!(config?.apiUrl && config?.username);
  }

  clearConfiguration(): void {
    localStorage.removeItem('gps51_api_url');
    localStorage.removeItem('gps51_username');
    localStorage.removeItem('gps51_api_key');
    localStorage.removeItem('gps51_from');
    localStorage.removeItem('gps51_type');
    localStorage.removeItem('gps51_credentials');
    this.authService.logout();
    console.log('GPS51 configuration cleared');
  }
}

export const gps51ConfigService = GPS51ConfigService.getInstance();
