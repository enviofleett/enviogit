import { GPS51Client } from './GPS51Client';
import { GPS51TimeManager } from './GPS51TimeManager';
import { GPS51Device, GPS51Position } from './types';

/**
 * Enhanced live data retrieval with robust error handling and device activity monitoring
 */
export class GPS51LiveDataEnhancer {
  private client: GPS51Client;
  private lastQueryPositionTime: number = 0;
  private deviceActivityCache = new Map<string, { lastActive: number; isOnline: boolean }>();
  private consecutiveEmptyResponses = 0;
  private maxEmptyResponses = 3;

  constructor(client: GPS51Client) {
    this.client = client;
  }

  /**
   * Enhanced device list fetch with activity analysis
   */
  async fetchDevicesWithActivity(): Promise<{
    devices: GPS51Device[];
    onlineDevices: GPS51Device[];
    offlineDevices: GPS51Device[];
    activitySummary: {
      total: number;
      online: number;
      offline: number;
      recentlyActive: number;
    };
  }> {
    try {
      console.log('GPS51LiveDataEnhancer: Fetching devices with activity analysis...');
      
      const devices = await this.client.getDeviceList();
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const thirtyMinutesAgo = now - (30 * 60 * 1000); // 30 minutes in milliseconds
      const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes in milliseconds

      const onlineDevices: GPS51Device[] = [];
      const offlineDevices: GPS51Device[] = [];
      let recentlyActiveCount = 0;

      for (const device of devices) {
        const lastActiveTime = device.lastactivetime || 0;
        const isOnline = lastActiveTime > thirtyMinutesAgo;
        const isRecentlyActive = lastActiveTime > fiveMinutesAgo;

        // Update activity cache
        this.deviceActivityCache.set(device.deviceid, {
          lastActive: lastActiveTime,
          isOnline
        });

        if (isOnline) {
          onlineDevices.push(device);
        } else {
          offlineDevices.push(device);
        }

        if (isRecentlyActive) {
          recentlyActiveCount++;
        }

        console.log(`Device ${device.devicename} (${device.deviceid}):`, {
          lastActiveTime,
          lastActiveDate: lastActiveTime ? GPS51TimeManager.utcTimestampToWat(lastActiveTime).toISOString() : 'Never',
          isOnline,
          isRecentlyActive,
          minutesSinceLastActive: lastActiveTime ? Math.floor((now - lastActiveTime) / (60 * 1000)) : 'N/A'
        });
      }

      const activitySummary = {
        total: devices.length,
        online: onlineDevices.length,
        offline: offlineDevices.length,
        recentlyActive: recentlyActiveCount
      };

      console.log('GPS51LiveDataEnhancer: Device activity summary:', activitySummary);

      return {
        devices,
        onlineDevices,
        offlineDevices,
        activitySummary
      };
    } catch (error) {
      console.error('GPS51LiveDataEnhancer: Failed to fetch devices with activity:', error);
      throw error;
    }
  }

  /**
   * Enhanced live position fetch with robust timestamp management
   */
  async fetchLivePositionsEnhanced(deviceIds: string[]): Promise<{
    positions: GPS51Position[];
    lastQueryTime: number;
    hasNewData: boolean;
    serverTimeDrift: number;
    responseMetadata: {
      totalDevicesQueried: number;
      onlineDevicesQueried: number;
      positionsReceived: number;
      emptyResponseCount: number;
    };
  }> {
    try {
      GPS51TimeManager.logTimeSyncInfo('PreLivePositionQuery', this.lastQueryPositionTime);

      // Filter to only query online devices
      const onlineDeviceIds = deviceIds.filter(deviceId => {
        const activity = this.deviceActivityCache.get(deviceId);
        return activity?.isOnline === true;
      });

      console.log('GPS51LiveDataEnhancer: Live position query:', {
        totalDevicesRequested: deviceIds.length,
        onlineDevicesFiltered: onlineDeviceIds.length,
        offlineDevicesSkipped: deviceIds.length - onlineDeviceIds.length,
        lastQueryPositionTime: this.lastQueryPositionTime,
        lastQueryDate: this.lastQueryPositionTime ? GPS51TimeManager.utcTimestampToWat(this.lastQueryPositionTime).toISOString() : 'Initial query'
      });

      if (onlineDeviceIds.length === 0) {
        console.warn('GPS51LiveDataEnhancer: No online devices to query for live positions');
        return {
          positions: [],
          lastQueryTime: this.lastQueryPositionTime,
          hasNewData: false,
          serverTimeDrift: 0,
          responseMetadata: {
            totalDevicesQueried: deviceIds.length,
            onlineDevicesQueried: 0,
            positionsReceived: 0,
            emptyResponseCount: this.consecutiveEmptyResponses
          }
        };
      }

      // Make the API call with proper timestamp
      const result = await this.client.getRealtimePositions(
        onlineDeviceIds,
        this.lastQueryPositionTime
      );

      // Calculate server time drift
      const serverTimeDrift = GPS51TimeManager.calculateServerTimeDrift(result.lastQueryTime);
      
      GPS51TimeManager.logTimeSyncInfo('PostLivePositionQuery', result.lastQueryTime);

      // Check if we have new data
      const hasNewData = result.positions.length > 0;
      
      if (!hasNewData) {
        this.consecutiveEmptyResponses++;
        console.log(`GPS51LiveDataEnhancer: Empty response #${this.consecutiveEmptyResponses}/${this.maxEmptyResponses}`);
        
        if (this.consecutiveEmptyResponses >= this.maxEmptyResponses) {
          console.warn('GPS51LiveDataEnhancer: Multiple consecutive empty responses detected. Checking device activity...');
          // Trigger device activity refresh
          await this.refreshDeviceActivity();
        }
      } else {
        this.consecutiveEmptyResponses = 0;
        console.log(`GPS51LiveDataEnhancer: Received ${result.positions.length} new positions`);
      }

      // Update our timestamp for next query
      this.lastQueryPositionTime = result.lastQueryTime;

      // Validate and enrich position data
      const validatedPositions = this.validatePositions(result.positions);

      const responseMetadata = {
        totalDevicesQueried: deviceIds.length,
        onlineDevicesQueried: onlineDeviceIds.length,
        positionsReceived: validatedPositions.length,
        emptyResponseCount: this.consecutiveEmptyResponses
      };

      return {
        positions: validatedPositions,
        lastQueryTime: result.lastQueryTime,
        hasNewData,
        serverTimeDrift,
        responseMetadata
      };

    } catch (error) {
      console.error('GPS51LiveDataEnhancer: Enhanced live position fetch failed:', error);
      throw error;
    }
  }

  /**
   * Validate and clean position data
   */
  private validatePositions(positions: GPS51Position[]): GPS51Position[] {
    return positions.filter(position => {
      // Basic validation
      if (!position.deviceid || !position.updatetime) {
        console.warn('GPS51LiveDataEnhancer: Invalid position - missing required fields:', position);
        return false;
      }

      // Coordinate validation
      const lat = Number(position.callat);
      const lon = Number(position.callon);
      
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        console.warn('GPS51LiveDataEnhancer: Invalid coordinates:', { deviceid: position.deviceid, lat, lon });
        return false;
      }

      // Timestamp validation (not too old, not in the future)
      const positionTime = position.updatetime;
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const oneHourAgo = now - (60 * 60);
      const oneMinuteInFuture = now + 60;

      if (positionTime < oneHourAgo || positionTime > oneMinuteInFuture) {
        console.warn('GPS51LiveDataEnhancer: Position timestamp out of acceptable range:', {
          deviceid: position.deviceid,
          positionTime,
          positionDate: GPS51TimeManager.utcTimestampToWat(positionTime).toISOString(),
          currentTime: now
        });
        return false;
      }

      return true;
    });
  }

  /**
   * Refresh device activity status
   */
  private async refreshDeviceActivity(): Promise<void> {
    try {
      console.log('GPS51LiveDataEnhancer: Refreshing device activity due to consecutive empty responses...');
      const { activitySummary } = await this.fetchDevicesWithActivity();
      
      if (activitySummary.online === 0) {
        console.warn('GPS51LiveDataEnhancer: No devices are currently online!');
      } else {
        console.log(`GPS51LiveDataEnhancer: ${activitySummary.online} devices are online and available for live data`);
      }
    } catch (error) {
      console.error('GPS51LiveDataEnhancer: Failed to refresh device activity:', error);
    }
  }

  /**
   * Get device activity status
   */
  getDeviceActivity(deviceId: string): { lastActive: number; isOnline: boolean } | null {
    return this.deviceActivityCache.get(deviceId) || null;
  }

  /**
   * Reset query state (useful for debugging or manual refresh)
   */
  resetQueryState(): void {
    this.lastQueryPositionTime = 0;
    this.consecutiveEmptyResponses = 0;
    this.deviceActivityCache.clear();
    console.log('GPS51LiveDataEnhancer: Query state reset');
  }

  /**
   * Get current synchronization status
   */
  getSyncStatus() {
    return {
      lastQueryPositionTime: this.lastQueryPositionTime,
      lastQueryDate: this.lastQueryPositionTime ? GPS51TimeManager.utcTimestampToWat(this.lastQueryPositionTime).toISOString() : 'Not set',
      consecutiveEmptyResponses: this.consecutiveEmptyResponses,
      maxEmptyResponses: this.maxEmptyResponses,
      cachedDeviceCount: this.deviceActivityCache.size,
      onlineDeviceCount: Array.from(this.deviceActivityCache.values()).filter(d => d.isOnline).length
    };
  }
}