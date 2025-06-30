
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
   * Fetch live positions for the specified device IDs with proper server timestamp handling
   */
  async fetchLivePositions(deviceIds: string[], lastQueryTime?: number): Promise<{positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51DataFetcher: Fetching live positions (ENHANCED):', {
        deviceCount: deviceIds.length,
        inputLastQueryTime: lastQueryTime,
        isFirstCall: !lastQueryTime || lastQueryTime === 0,
        callType: (!lastQueryTime || lastQueryTime === 0) ? 'INITIAL' : 'INCREMENTAL'
      });
      
      // CRITICAL FIX: Pass the server's lastQueryTime directly to client
      const result = await this.client.getRealtimePositions(deviceIds, lastQueryTime);
      
      console.log('GPS51DataFetcher: Live positions result (ENHANCED):', {
        positionsRetrieved: result.positions.length,
        serverLastQueryTime: result.lastQueryTime,
        serverTimestamp: new Date(result.lastQueryTime).toISOString(),
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
   * Fetch complete live data with device activity pre-filtering and proper timestamp handling
   */
  async fetchCompleteLiveData(lastQueryTime?: number): Promise<{devices: GPS51Device[], positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51DataFetcher: Starting complete live data fetch (ENHANCED)...');
      
      // Step 1: Get all user devices
      const allDevices = await this.fetchUserDevices();
      
      if (allDevices.length === 0) {
        console.warn('GPS51DataFetcher: No devices found for user');
        return { devices: [], positions: [], lastQueryTime: lastQueryTime || 0 };
      }

      // Step 2: Pre-filter devices by activity status (PHASE 2 ENHANCEMENT)
      const { activeDevices, inactiveDevices } = this.filterActiveDevices(allDevices);
      
      if (activeDevices.length === 0) {
        console.warn('GPS51DataFetcher: No active devices found - all devices appear inactive');
        return { 
          devices: allDevices, 
          positions: [], 
          lastQueryTime: lastQueryTime || 0 
        };
      }

      // Step 3: Extract device IDs from active devices only
      const activeDeviceIds = activeDevices.map(device => device.deviceid);
      console.log('GPS51DataFetcher: Active device IDs for position query:', {
        activeDeviceCount: activeDeviceIds.length,
        inactiveDeviceCount: inactiveDevices.length,
        activeDeviceIds: activeDeviceIds.slice(0, 10) // Log first 10 for debugging
      });

      // Step 4: Fetch live positions for active devices with proper timestamp handling
      const { positions, lastQueryTime: newLastQueryTime } = await this.fetchLivePositions(activeDeviceIds, lastQueryTime);

      console.log('GPS51DataFetcher: Complete live data fetch completed (ENHANCED):', {
        totalDevices: allDevices.length,
        activeDevices: activeDevices.length,
        positionsRetrieved: positions.length,
        serverLastQueryTime: newLastQueryTime,
        successRate: activeDevices.length > 0 ? (positions.length / activeDevices.length * 100).toFixed(1) + '%' : '0%'
      });

      return {
        devices: allDevices, // Return all devices for UI display
        positions,
        lastQueryTime: newLastQueryTime // Use server's timestamp for next call
      };
    } catch (error) {
      console.error('GPS51DataFetcher: Complete live data fetch failed:', error);
      throw error;
    }
  }
}
