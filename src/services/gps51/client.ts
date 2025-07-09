
import { GPS51Vehicle, GPS51Position, GPS51Telemetry, GPS51Geofence, GPS51ApiConfig } from './types';
import { GPS51ProxyClient } from './GPS51ProxyClient';

export class GPS51Client {
  private config: GPS51ApiConfig;
  private proxyClient: GPS51ProxyClient;

  constructor(config?: GPS51ApiConfig) {
    // Load config from localStorage if not provided
    if (!config) {
      const username = localStorage.getItem('gps51_username');
      const token = localStorage.getItem('gps51_token');
      const apiUrl = localStorage.getItem('gps51_api_url');
      
      if (!username || !token || !apiUrl) {
        throw new Error('GPS51Client: No credentials available. Please authenticate first.');
      }

      // Parse token if it's stored as JSON
      let parsedToken = token;
      try {
        const tokenData = JSON.parse(token);
        parsedToken = tokenData.token || tokenData.access_token || token;
      } catch {
        // Token is already a string
      }
      
      this.config = {
        baseUrl: apiUrl,
        username,
        token: parsedToken,
        timeout: 30000
      };
    } else {
      this.config = config;
    }
    
    this.proxyClient = GPS51ProxyClient.getInstance();
  }

  private async makeRequest<T>(action: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await this.proxyClient.makeRequest(
        action,
        this.config.token,
        params || {},
        'POST',
        this.config.baseUrl
      );

      // Handle different response formats
      if (response.data) {
        return response.data as T;
      }
      
      // For some endpoints, the response itself is the data
      return response as T;
    } catch (error) {
      console.error(`GPS51Client: Error in ${action}:`, error);
      throw new Error(`GPS51 API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Device Management (using GPS51 API actions)
  async getDevices(): Promise<GPS51Vehicle[]> {
    const response = await this.makeRequest<any>('getdevices', {
      username: this.config.username
    });
    
    // Convert GPS51 devices to GPS51Vehicle format
    const devices = response.devices || response.data?.devices || [];
    return devices.map((device: any) => ({
      id: device.deviceid,
      name: device.devicename || device.name,
      plate: device.devicename || device.plate || 'Unknown',
      brand: device.brand,
      model: device.model,
      type: 'car' as const,
      status: device.isfree === 0 ? 'active' : 'inactive' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
  }

  async getVehicles(): Promise<GPS51Vehicle[]> {
    return this.getDevices();
  }

  async getVehicle(id: string): Promise<GPS51Vehicle> {
    const vehicles = await this.getDevices();
    const vehicle = vehicles.find(v => v.id === id);
    if (!vehicle) {
      throw new Error(`Vehicle ${id} not found`);
    }
    return vehicle;
  }

  // Real-time Positions
  async getVehiclePosition(vehicleId: string): Promise<GPS51Position> {
    const positions = await this.getAllVehiclePositions();
    const position = positions.find(p => p.deviceid === vehicleId);
    if (!position) {
      throw new Error(`No position found for vehicle ${vehicleId}`);
    }
    return position;
  }

  async getAllVehiclePositions(): Promise<GPS51Position[]> {
    const response = await this.makeRequest<any>('lastposition', {
      username: this.config.username,
      deviceids: [], // Empty array means all devices
      lastquerypositiontime: 0
    });
    
    return response.records || response.data?.records || [];
  }

  // Historical Data
  async getVehicleHistory(
    vehicleId: string,
    from: Date,
    to: Date
  ): Promise<GPS51Position[]> {
    const response = await this.makeRequest<any>('gettracks', {
      username: this.config.username,
      deviceid: vehicleId,
      fromtime: Math.floor(from.getTime() / 1000),
      totime: Math.floor(to.getTime() / 1000)
    });
    
    return response.records || response.data?.records || [];
  }

  // Telemetry Data (derived from position data)
  async getVehicleTelemetry(vehicleId: string): Promise<GPS51Telemetry> {
    const position = await this.getVehiclePosition(vehicleId);
    
    return {
      vehicleId,
      odometer: position.totaldistance || 0,
      fuelLevel: position.fuel || position.totaloil || 0,
      engineTemperature: position.temp1 || 0,
      batteryVoltage: position.voltage || 0,
      engineHours: 0, // Not directly available in GPS51
      timestamp: new Date(position.updatetime * 1000).toISOString()
    };
  }

  // Geofencing (placeholder - GPS51 has different geofence implementation)
  async getGeofences(): Promise<GPS51Geofence[]> {
    // GPS51 doesn't have direct geofence API in this format
    // This would need to be implemented using GPS51's specific geofence actions
    console.warn('GPS51Client: Geofencing not yet implemented for GPS51 API');
    return [];
  }

  async createGeofence(geofence: Omit<GPS51Geofence, 'id'>): Promise<GPS51Geofence> {
    // GPS51 doesn't have direct geofence API in this format
    console.warn('GPS51Client: Geofence creation not yet implemented for GPS51 API');
    throw new Error('Geofence creation not implemented for GPS51 API');
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      await this.getDevices();
      return true;
    } catch (error) {
      console.error('GPS51Client: Connection test failed:', error);
      return false;
    }
  }

  getConfig(): GPS51ApiConfig {
    return { ...this.config };
  }
}
