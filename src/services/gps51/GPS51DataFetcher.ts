
import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from './types';
import { GPS51TimeManager } from './GPS51TimeManager';

export class GPS51DataFetcher {
  private coordinatorClient = gps51CoordinatorClient;

  constructor() {
    // Now uses the coordinator client for all GPS51 interactions
  }

  /**
   * Fetch all devices for the authenticated user through coordinator
   */
  async fetchUserDevices(): Promise<GPS51Device[]> {
    try {
      console.log('GPS51DataFetcher: Fetching user devices through coordinator...');
      
      const devices = await this.coordinatorClient.getDeviceList();
      console.log(`GPS51DataFetcher: Retrieved ${devices.length} devices`);
      
      return devices;
    } catch (error) {
      console.error('GPS51DataFetcher: Failed to fetch user devices:', error);
      throw new Error(`Failed to fetch user devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Pre-filter devices by activity status to improve live data success rate
   */
  private filterActiveDevices(devices: GPS51Device[]): {activeDevices: GPS51Device[], inactiveDevices: GPS51Device[]} {
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000); // 30 minutes
    const twoHoursAgo = now - (2 * 60 * 60 * 1000); // 2 hours
    
    const activeDevices = devices.filter(device => {
      // Device is considered active if it has recent lastactivetime
      if (device.lastactivetime && device.lastactivetime > thirtyMinutesAgo) {
        return true;
      }
      
      // Include devices that were active within 2 hours for broader coverage
      if (device.lastactivetime && device.lastactivetime > twoHoursAgo) {
        return true;
      }
      
      // Include devices without lastactivetime (might be new or misconfigured)
      if (!device.lastactivetime) {
        return true;
      }
      
      return false;
    });
    
    const inactiveDevices = devices.filter(device => !activeDevices.includes(device));
    
    console.log('GPS51DataFetcher: Device activity filtering:', {
      totalDevices: devices.length,
      activeDevices: activeDevices.length,
      inactiveDevices: inactiveDevices.length,
      activityCriteria: {
        thirtyMinutesAgo: new Date(thirtyMinutesAgo).toISOString(),
        twoHoursAgo: new Date(twoHoursAgo).toISOString()
      }
    });
    
    return { activeDevices, inactiveDevices };
  }

  /**
   * Fetch live positions for the specified device IDs through coordinator
   */
  async fetchLivePositions(deviceIds: string[], lastQueryTime?: number): Promise<{positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51DataFetcher: Fetching live positions through coordinator:', {
        deviceCount: deviceIds.length,
        inputLastQueryTime: lastQueryTime,
        isFirstCall: !lastQueryTime || lastQueryTime === 0,
        callType: (!lastQueryTime || lastQueryTime === 0) ? 'INITIAL' : 'INCREMENTAL'
      });
      
      // Use coordinator for all GPS51 API calls
      const result = await this.coordinatorClient.getRealtimePositions(deviceIds, lastQueryTime);
      
      console.log('GPS51DataFetcher: Live positions result through coordinator:', {
        positionsRetrieved: result.positions.length,
        serverLastQueryTime: result.lastQueryTime,
        serverTimestamp: result.lastQueryTime ? new Date(result.lastQueryTime).toISOString() : 'N/A',
        hasPositionData: result.positions.length > 0
      });
      
      // Additional position data analysis for debugging
      if (result.positions.length > 0) {
        const sample = result.positions[0];
        console.log('GPS51DataFetcher: Sample position data:', {
          deviceid: sample.deviceid,
          updatetime: sample.updatetime,
          updateDate: new Date(sample.updatetime).toISOString(),
          coordinates: `${sample.callat}, ${sample.callon}`,
          speed: sample.speed,
          moving: sample.moving
        });
      }
      
      return result;
    } catch (error) {
      console.error('GPS51DataFetcher: Failed to fetch live positions:', error);
      throw new Error(`Failed to fetch live positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch complete live data through coordinator with simplified architecture
   */
  async fetchCompleteLiveData(lastQueryTime?: number): Promise<{devices: GPS51Device[], positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51DataFetcher: Starting coordinated live data fetch...');
      GPS51TimeManager.logTimeSyncInfo('FetchStart', lastQueryTime);
      
      // Step 1: Get devices through coordinator
      const allDevices = await this.coordinatorClient.getDeviceList();
      
      if (allDevices.length === 0) {
        console.warn('GPS51DataFetcher: No devices found for user');
        return { devices: [], positions: [], lastQueryTime: lastQueryTime || GPS51TimeManager.getCurrentUtcTimestamp() };
      }

      // Step 2: Filter active devices using existing logic
      const { activeDevices } = this.filterActiveDevices(allDevices);
      
      console.log('GPS51DataFetcher: Device filtering results:', {
        totalDevices: allDevices.length,
        activeDevices: activeDevices.length
      });

      // Step 3: Get device IDs for position fetching
      const targetDeviceIds = activeDevices.length > 0 
        ? activeDevices.map(device => device.deviceid)
        : allDevices.slice(0, 50).map(device => device.deviceid); // Limit to 50 devices max

      console.log(`GPS51DataFetcher: Fetching positions for ${targetDeviceIds.length} devices`);

      // Step 4: Fetch positions through coordinator
      const { positions, lastQueryTime: newLastQueryTime } = await this.coordinatorClient.getRealtimePositions(
        targetDeviceIds,
        lastQueryTime
      );

      console.log('GPS51DataFetcher: Coordinated fetch completed:', {
        totalDevices: allDevices.length,
        targetDevices: targetDeviceIds.length,
        positionsRetrieved: positions.length,
        successRate: targetDeviceIds.length > 0 ? (positions.length / targetDeviceIds.length * 100).toFixed(1) + '%' : '0%'
      });

      return {
        devices: allDevices,
        positions,
        lastQueryTime: newLastQueryTime
      };
    } catch (error) {
      console.error('GPS51DataFetcher: Coordinated live data fetch failed:', error);
      throw error;
    }
  }
}
