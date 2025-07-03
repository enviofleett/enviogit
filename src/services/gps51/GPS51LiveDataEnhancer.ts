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
      const fourHoursAgo = now - (4 * 60 * 60 * 1000); // 4 hours in milliseconds
      const thirtyMinutesAgo = now - (30 * 60 * 1000); // 30 minutes in milliseconds
      const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes in milliseconds

      // DIAGNOSTIC: Log time comparison values for debugging
      console.log('🕐 GPS51LiveDataEnhancer: Time comparison debug:', {
        currentTimestamp: now,
        currentDate: new Date(now).toISOString(),
        fourHoursAgo,
        fourHoursAgoDate: new Date(fourHoursAgo).toISOString(),
        thirtyMinutesAgo,
        thirtyMinutesAgoDate: new Date(thirtyMinutesAgo).toISOString(),
        fiveMinutesAgo,
        fiveMinutesAgoDate: new Date(fiveMinutesAgo).toISOString()
      });

      const onlineDevices: GPS51Device[] = [];
      const offlineDevices: GPS51Device[] = [];
      let recentlyActiveCount = 0;

      // CRITICAL DIAGNOSTIC: Let's examine the first 5 devices in detail to understand the time issue
      const sampleDevices = devices.slice(0, 5);
      console.log('🔍 CRITICAL TIME DIAGNOSTIC - Analyzing first 5 devices:', {
        currentTimestamp: now,
        currentDate: new Date(now).toISOString(),
        thirtyMinutesAgo,
        thirtyMinutesAgoDate: new Date(thirtyMinutesAgo).toISOString(),
        totalDevices: devices.length
      });

      for (const device of sampleDevices) {
        const lastActiveTime = device.lastactivetime || 0;
        console.log(`🔍 SAMPLE Device: ${device.devicename}`, {
          deviceid: device.deviceid,
          lastactivetime: lastActiveTime,
          lastActiveAsDate: lastActiveTime ? new Date(lastActiveTime).toISOString() : 'Never',
          lastActiveAsDateSeconds: lastActiveTime ? new Date(lastActiveTime * 1000).toISOString() : 'Never (as seconds)',
          timeDifferenceMs: now - lastActiveTime,
          timeDifferenceMinutes: lastActiveTime ? Math.floor((now - lastActiveTime) / (60 * 1000)) : 'N/A',
          isValidFutureDate: lastActiveTime > now,
          comparisonResult: `${lastActiveTime} > ${thirtyMinutesAgo} = ${lastActiveTime > thirtyMinutesAgo}`
        });
      }

      for (const device of devices) {
        const lastActiveTimeRaw = device.lastactivetime || 0;
        // CRITICAL FIX: GPS51 API already returns timestamps in milliseconds, no conversion needed
        const lastActiveTime = this.validateAndNormalizeTimestamp(lastActiveTimeRaw);
        
        const isOnline = lastActiveTime > fourHoursAgo; // Expanded from 30 minutes to 4 hours
        const isRecentlyActive = lastActiveTime > thirtyMinutesAgo;
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

        // Only log first 5 devices to avoid spam
        if (devices.indexOf(device) < 5) {
          console.log(`🚗 DETAILED Device ${devices.indexOf(device)}: ${device.devicename} (${device.deviceid}):`, {
            lastActiveTimeRaw: lastActiveTimeRaw,
            lastActiveTime,
            lastActiveDate: lastActiveTime ? GPS51TimeManager.utcTimestampToWat(lastActiveTime).toISOString() : 'Never',
            isOnline,
            isRecentlyActive,
            minutesSinceLastActive: lastActiveTime ? Math.floor((now - lastActiveTime) / (60 * 1000)) : 'N/A',
            thirtyMinutesAgo,
            comparisonDebug: `${lastActiveTime} > ${fourHoursAgo} = ${isOnline}`
          });
        }
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

      // DIAGNOSTIC: Enhanced logging with device ID details
      const skippedDevices = deviceIds.filter(id => !onlineDeviceIds.includes(id));
      console.log('🔍 GPS51LiveDataEnhancer: Live position query analysis:', {
        totalDevicesRequested: deviceIds.length,
        onlineDevicesFiltered: onlineDeviceIds.length,
        offlineDevicesSkipped: deviceIds.length - onlineDeviceIds.length,
        onlineDeviceIds: onlineDeviceIds,
        skippedOfflineDeviceIds: skippedDevices,
        lastQueryPositionTime: this.lastQueryPositionTime,
        lastQueryDate: this.lastQueryPositionTime ? new Date(this.lastQueryPositionTime).toISOString() : 'Initial query'
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
   * Validate and normalize timestamp to ensure it's in milliseconds
   */
  private validateAndNormalizeTimestamp(timestamp: number): number {
    if (timestamp === 0) return 0;
    
    // If timestamp is in seconds (roughly before year 2100), convert to milliseconds
    if (timestamp < 4000000000) {
      console.warn(`Converting timestamp from seconds to milliseconds: ${timestamp}`);
      return timestamp * 1000;
    }
    
    // Already in milliseconds
    return timestamp;
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