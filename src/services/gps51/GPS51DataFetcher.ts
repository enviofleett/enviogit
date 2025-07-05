import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device, GPS51Position } from './GPS51Types';
import { GPS51TimeManager } from './GPS51TimeManager';

export interface CompleteLiveDataResult {
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastQueryTime: number;
}

export class GPS51DataFetcher {
  private client: GPS51Client;

  constructor(client: GPS51Client = gps51Client) {
    this.client = client;
  }

  /**
   * Fetch complete live data using the two-step GPS51 API flow
   */
  async fetchCompleteLiveData(lastQueryTime: number = 0): Promise<CompleteLiveDataResult> {
    try {
      console.log('GPS51DataFetcher: Starting complete live data fetch...');
      
      // Step 1: Get device list
      console.log('GPS51DataFetcher: Fetching device list...');
      const devices = await this.client.getDeviceList();
      
      if (devices.length === 0) {
        console.warn('GPS51DataFetcher: No devices found');
        return {
          devices: [],
          positions: [],
          lastQueryTime: Date.now()
        };
      }

      console.log(`GPS51DataFetcher: Found ${devices.length} devices`);

      // Step 2: Get positions for all devices
      const deviceIds = devices.map(device => device.deviceid);
      console.log('GPS51DataFetcher: Fetching positions for devices...');
      
      const positionResult = await this.client.getRealtimePositions(deviceIds, lastQueryTime);
      
      console.log('GPS51DataFetcher: Complete live data fetch successful', {
        devicesCount: devices.length,
        positionsCount: positionResult.positions.length,
        lastQueryTime: positionResult.lastQueryTime
      });

      return {
        devices,
        positions: positionResult.positions,
        lastQueryTime: positionResult.lastQueryTime
      };

    } catch (error) {
      console.error('GPS51DataFetcher: Complete live data fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch only device list
   */
  async fetchDevices(): Promise<GPS51Device[]> {
    try {
      console.log('GPS51DataFetcher: Fetching device list only...');
      const devices = await this.client.getDeviceList();
      console.log(`GPS51DataFetcher: Fetched ${devices.length} devices`);
      return devices;
    } catch (error) {
      console.error('GPS51DataFetcher: Device list fetch failed:', error);
      throw error;
    }
  }

  /**
   * Fetch only positions for specific devices
   */
  async fetchPositions(deviceIds: string[], lastQueryTime: number = 0): Promise<{
    positions: GPS51Position[];
    lastQueryTime: number;
  }> {
    try {
      console.log('GPS51DataFetcher: Fetching positions only...', {
        deviceCount: deviceIds.length,
        lastQueryTime
      });
      
      const result = await this.client.getRealtimePositions(deviceIds, lastQueryTime);
      
      console.log(`GPS51DataFetcher: Fetched ${result.positions.length} positions`);
      return result;
    } catch (error) {
      console.error('GPS51DataFetcher: Position fetch failed:', error);
      throw error;
    }
  }
}