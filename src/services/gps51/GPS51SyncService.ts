
import { GPS51Client } from './GPS51Client';

export interface SyncResult {
  success: boolean;
  vehiclesSynced?: number;
  positionsStored?: number;
  error?: string;
}

export class GPS51SyncService {
  private gps51Client: GPS51Client;

  constructor() {
    this.gps51Client = new GPS51Client();
  }

  /**
   * Sync data from GPS51 API
   */
  async syncData(): Promise<SyncResult> {
    try {
      console.log('GPS51SyncService: Starting data sync...');
      
      if (!this.gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      // Get device list from GPS51
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

      return {
        success: true,
        vehiclesSynced: devices.length,
        positionsStored: positions.length
      };

    } catch (error) {
      console.error('GPS51SyncService: Sync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  /**
   * Set the GPS51 client instance (for dependency injection)
   */
  setClient(client: GPS51Client): void {
    this.gps51Client = client;
  }

  /**
   * Get the current GPS51 client
   */
  getClient(): GPS51Client {
    return this.gps51Client;
  }
}

export const gps51SyncService = new GPS51SyncService();
