
import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device, GPS51Position } from './types';

export class GPS51DataFetcher {
  private client: GPS51Client;

  constructor(client: GPS51Client = gps51Client) {
    this.client = client;
  }

  /**
   * Fetch all devices for the authenticated user
   */
  async fetchUserDevices(): Promise<GPS51Device[]> {
    try {
      console.log('GPS51DataFetcher: Fetching user devices...');
      
      const devices = await this.client.getDeviceList();
      console.log(`GPS51DataFetcher: Retrieved ${devices.length} devices`);
      
      return devices;
    } catch (error) {
      console.error('GPS51DataFetcher: Failed to fetch user devices:', error);
      throw new Error(`Failed to fetch user devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch live positions for the specified device IDs
   */
  async fetchLivePositions(deviceIds: string[], lastQueryTime?: number): Promise<{positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51DataFetcher: Fetching live positions for devices:', deviceIds);
      
      const positions = await this.client.getRealtimePositions(deviceIds, lastQueryTime);
      
      // Note: The GPS51 API should return lastquerypositiontime in the response
      // For now, we'll use the current timestamp as fallback
      const newLastQueryTime = Date.now();
      
      console.log(`GPS51DataFetcher: Retrieved ${positions.length} live positions`);
      
      return { positions, lastQueryTime: newLastQueryTime };
    } catch (error) {
      console.error('GPS51DataFetcher: Failed to fetch live positions:', error);
      throw new Error(`Failed to fetch live positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch complete live data (devices + positions)
   */
  async fetchCompleteLiveData(lastQueryTime?: number): Promise<{devices: GPS51Device[], positions: GPS51Position[], lastQueryTime: number}> {
    // Step 1: Get all user devices to obtain device IDs
    const devices = await this.fetchUserDevices();
    
    if (devices.length === 0) {
      console.warn('GPS51DataFetcher: No devices found for user');
      return { devices: [], positions: [], lastQueryTime: lastQueryTime || 0 };
    }

    // Extract device IDs
    const deviceIds = devices.map(device => device.deviceid);
    console.log('GPS51DataFetcher: Device IDs extracted:', deviceIds);

    // Step 2: Fetch live positions for all devices
    const { positions, lastQueryTime: newLastQueryTime } = await this.fetchLivePositions(deviceIds, lastQueryTime);

    return {
      devices,
      positions,
      lastQueryTime: newLastQueryTime
    };
  }
}
