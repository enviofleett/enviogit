
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
  positionsFound?: number;
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
      console.log('GPS51ConfigService: Saving configuration...');
      
      // Validate required fields
      if (!config.apiUrl || !config.username || !config.password) {
        throw new Error('Missing required configuration fields');
      }

      // Migrate old webapi endpoint to new openapi endpoint
      let apiUrl = config.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51ConfigService: Migrating from deprecated /webapi to /openapi endpoint');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }

      // Store configuration in localStorage with consistent keys
      const configData = {
        apiUrl: apiUrl,
        username: config.username,
        from: config.from || 'WEB',
        type: config.type || 'USER',
        apiKey: config.apiKey || '',
        savedAt: new Date().toISOString()
      };

      // Save individual items for backward compatibility
      localStorage.setItem('gps51_api_url', configData.apiUrl);
      localStorage.setItem('gps51_username', configData.username);
      localStorage.setItem('gps51_password_hash', config.password); // Store hashed password
      localStorage.setItem('gps51_from', configData.from);
      localStorage.setItem('gps51_type', configData.type);
      
      if (configData.apiKey) {
        localStorage.setItem('gps51_api_key', configData.apiKey);
      }

      // Store safe credentials for auth service (without password for security)
      const safeCredentials = {
        username: configData.username,
        apiUrl: configData.apiUrl,
        from: configData.from,
        type: configData.type,
        hasApiKey: !!configData.apiKey,
        savedAt: configData.savedAt
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));

      console.log('GPS51ConfigService: Configuration saved successfully:', {
        keys: Object.keys(configData),
        hasPassword: !!config.password,
        savedItems: Object.keys(localStorage).filter(k => k.startsWith('gps51_'))
      });
    } catch (error) {
      console.error('GPS51ConfigService: Failed to save configuration:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getConfiguration(): GPS51Config | null {
    try {
      let apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const passwordHash = localStorage.getItem('gps51_password_hash');
      const apiKey = localStorage.getItem('gps51_api_key');
      const from = localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
      const type = localStorage.getItem('gps51_type') as 'USER' | 'DEVICE';

      // Migrate old webapi endpoint to new openapi endpoint
      if (apiUrl && apiUrl.includes('/webapi')) {
        console.warn('GPS51ConfigService: Auto-migrating stored API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
        localStorage.setItem('gps51_api_url', apiUrl); // Update stored value
      }

      if (apiUrl && username) {
        const config = {
          apiUrl: apiUrl,
          username,
          password: passwordHash || '', // Return stored hash if available
          apiKey: apiKey || undefined,
          from: from || 'WEB',
          type: type || 'USER'
        };
        
        console.log('GPS51ConfigService: Retrieved configuration:', {
          hasApiUrl: !!config.apiUrl,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          hasApiKey: !!config.apiKey,
          from: config.from,
          type: config.type,
          usingNewEndpoint: config.apiUrl.includes('/openapi')
        });
        
        return config;
      }
    } catch (error) {
      console.error('GPS51ConfigService: Failed to load configuration:', error);
    }

    return null;
  }

  async testConnection(config: GPS51Config): Promise<boolean> {
    try {
      console.log('GPS51ConfigService: Testing connection...');
      
      const credentials: GPS51Credentials = {
        username: config.username,
        password: config.password, // Should already be hashed
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        from: config.from || 'WEB',
        type: config.type || 'USER'
      };

      const token = await this.authService.authenticate(credentials);
      const isValid = !!token.access_token;
      
      console.log('GPS51ConfigService: Connection test result:', {
        success: isValid,
        hasToken: !!token.access_token
      });
      
      return isValid;
    } catch (error) {
      console.error('GPS51ConfigService: Connection test failed:', error);
      throw error;
    }
  }

  async syncData(): Promise<GPS51SyncResult> {
    try {
      console.log('GPS51ConfigService: Starting data sync...');

      // Get valid token
      const token = await this.authService.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      // Fetch devices using the GPS51 client
      const devices = await gps51Client.getDeviceList();
      console.log(`GPS51ConfigService: Found ${devices.length} devices from GPS51`);

      // Fetch real-time positions
      const deviceIds = devices.map(d => d.deviceid);
      const positions = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`GPS51ConfigService: Found ${positions.length} positions from GPS51`);

      // Store vehicles in Supabase with GPS51 device IDs
      let vehiclesSynced = 0;
      const deviceToVehicleMap = new Map<string, string>();
      
      for (const device of devices) {
        try {
          const vehicleData = {
            license_plate: device.devicename,
            gps51_device_id: device.deviceid, // Store GPS51 device ID for position mapping
            brand: 'GPS51',
            model: `Device ${device.devicetype}`,
            type: this.mapDeviceTypeToVehicleType(device.devicetype),
            status: (device.isfree === 1 ? 'available' : 'assigned') as 'available' | 'inactive' | 'maintenance' | 'assigned',
            notes: `Device ID: ${device.deviceid}, SIM: ${device.simnum}`,
            updated_at: new Date().toISOString()
          };

          console.log(`GPS51ConfigService: Syncing vehicle: ${device.devicename} with GPS51 ID: ${device.deviceid}`);

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
            console.log(`GPS51ConfigService: Successfully synced vehicle ${device.devicename} -> ${vehicleResult.id}`);
          } else {
            console.warn(`GPS51ConfigService: Failed to sync vehicle ${device.deviceid}:`, error);
          }
        } catch (err) {
          console.warn(`GPS51ConfigService: Error syncing vehicle ${device.deviceid}:`, err);
        }
      }

      // Store positions using GPS51 device ID mapping
      let positionsStored = 0;
      for (const position of positions) {
        try {
          console.log(`GPS51ConfigService: Processing position for GPS51 device: ${position.deviceid}`);

          // Find vehicle by GPS51 device ID instead of license plate
          const { data: vehicle, error: vehicleQueryError } = await supabase
            .from('vehicles')
            .select('id')
            .eq('gps51_device_id', position.deviceid)
            .single();

          if (vehicleQueryError) {
            console.warn(`GPS51ConfigService: Error finding vehicle for device ${position.deviceid}:`, vehicleQueryError);
            continue;
          }

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

            console.log(`GPS51ConfigService: Storing position for vehicle ${vehicle.id}:`, {
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
              console.log(`GPS51ConfigService: Successfully stored position for device ${position.deviceid}`);
            } else {
              console.warn(`GPS51ConfigService: Failed to store position for device ${position.deviceid}:`, error);
            }
          } else {
            console.warn(`GPS51ConfigService: No vehicle found for GPS51 device ID: ${position.deviceid}`);
          }
        } catch (err) {
          console.warn(`GPS51ConfigService: Error storing position for ${position.deviceid}:`, err);
        }
      }

      console.log(`GPS51ConfigService: Sync completed: ${vehiclesSynced} vehicles, ${positionsStored} positions`);

      return {
        success: true,
        vehiclesSynced,
        positionsStored,
        devicesFound: devices.length,
        positionsFound: positions.length
      };

    } catch (error) {
      console.error('GPS51ConfigService: Sync failed:', error);
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
    const isConfigured = !!(config?.apiUrl && config?.username && config?.password);
    
    console.log('GPS51ConfigService: Configuration check:', {
      hasConfig: !!config,
      hasApiUrl: !!config?.apiUrl,
      hasUsername: !!config?.username,
      hasPassword: !!config?.password,
      isConfigured
    });
    
    return isConfigured;
  }

  clearConfiguration(): void {
    const keysToRemove = [
      'gps51_api_url',
      'gps51_username', 
      'gps51_password_hash',
      'gps51_api_key',
      'gps51_from',
      'gps51_type',
      'gps51_credentials'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    this.authService.logout();
    console.log('GPS51ConfigService: Configuration cleared, removed keys:', keysToRemove);
  }
}

export const gps51ConfigService = GPS51ConfigService.getInstance();
