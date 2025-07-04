import { GPS51Client } from './GPS51Client';
import { GPS51TimeManager } from './GPS51TimeManager';
import { GPS51Device, GPS51Position } from './types';
import { GPS51TimestampUtils } from './GPS51TimestampUtils';

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
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days - realistic for GPS fleet devices
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 days fallback
      const thirtyMinutesAgo = now - (30 * 60 * 1000); // 30 minutes for recent activity

      console.log('GPS51LiveDataEnhancer: Time thresholds for device activity:', {
        currentTime: new Date(now).toISOString(),
        sevenDaysAgo: new Date(sevenDaysAgo).toISOString(),
        thirtyDaysAgo: new Date(thirtyDaysAgo).toISOString(),
        totalDevices: devices.length
      });

      const onlineDevices: GPS51Device[] = [];
      const offlineDevices: GPS51Device[] = [];
      let recentlyActiveCount = 0;

      // Sample first few devices for activity analysis
      const sampleDevices = devices.slice(0, 3);
      for (const device of sampleDevices) {
        const lastActiveTime = device.lastactivetime || 0;
        console.log(`Device Sample: ${device.devicename}`, {
          deviceid: device.deviceid,
          lastActiveTime: lastActiveTime ? new Date(lastActiveTime).toISOString() : 'Never',
          hoursAgo: lastActiveTime ? Math.floor((now - lastActiveTime) / (60 * 60 * 1000)) : 'N/A'
        });
      }

      for (const device of devices) {
        const lastActiveTimeRaw = device.lastactivetime || 0;
        // CRITICAL FIX: GPS51 API already returns timestamps in milliseconds, no conversion needed
        const lastActiveTime = GPS51TimestampUtils.validateAndNormalizeTimestamp(lastActiveTimeRaw);
        
        const isOnline = lastActiveTime > sevenDaysAgo; // 7 days - realistic for GPS fleet devices
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
            comparisonDebug: `${lastActiveTime} > ${sevenDaysAgo} = ${isOnline}`
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
      fallbackStrategy?: string;
    };
  }> {
    try {
      GPS51TimeManager.logTimeSyncInfo('PreLivePositionQuery', this.lastQueryPositionTime);
      
      // Define time thresholds for fallback strategies
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

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

      // CRITICAL FIX: If no "online" devices, try progressive fallback strategy
      if (onlineDeviceIds.length === 0) {
        console.warn('GPS51LiveDataEnhancer: No online devices found, trying progressive fallback strategy...');
        
        // Progressive fallback: Try different strategies with expanded thresholds
        const fallbackStrategies = [
          // Strategy 1: Try 30-day threshold (very lenient for fleet devices)
          {
            name: 'Recent30Days',
            devices: deviceIds
              .map(id => ({ id, activity: this.deviceActivityCache.get(id) }))
              .filter(d => d.activity?.lastActive && d.activity.lastActive > thirtyDaysAgo)
              .sort((a, b) => (b.activity?.lastActive || 0) - (a.activity?.lastActive || 0))
              .slice(0, 100)
              .map(d => d.id)
          },
          // Strategy 2: Top 50 most recently active devices (any activity)
          {
            name: 'Top50Active',
            devices: deviceIds
              .map(id => ({ id, activity: this.deviceActivityCache.get(id) }))
              .filter(d => d.activity?.lastActive && d.activity.lastActive > 0)
              .sort((a, b) => (b.activity?.lastActive || 0) - (a.activity?.lastActive || 0))
              .slice(0, 50)
              .map(d => d.id)
          },
          // Strategy 3: Smart device rotation - always select top devices
          {
            name: 'SmartRotation',
            devices: deviceIds.slice(0, 50)
          }
        ];
        
        for (const strategy of fallbackStrategies) {
          if (strategy.devices.length === 0) continue;
          
          console.log(`GPS51LiveDataEnhancer: Trying fallback strategy "${strategy.name}" with ${strategy.devices.length} devices`);
          
          try {
            const fallbackResult = await this.client.getRealtimePositions(
              strategy.devices,
              this.lastQueryPositionTime
            );
            
            console.log(`GPS51LiveDataEnhancer: Strategy "${strategy.name}" result:`, {
              positionsReceived: fallbackResult.positions.length,
              lastQueryTime: fallbackResult.lastQueryTime,
              success: fallbackResult.positions.length > 0
            });
            
            if (fallbackResult.positions.length > 0 || strategy.name === 'Active50') {
              // Success or last strategy - use this result
              this.lastQueryPositionTime = fallbackResult.lastQueryTime;
              
              return {
                positions: this.validatePositions(fallbackResult.positions),
                lastQueryTime: fallbackResult.lastQueryTime,
                hasNewData: fallbackResult.positions.length > 0,
                serverTimeDrift: GPS51TimeManager.calculateServerTimeDrift(fallbackResult.lastQueryTime),
                responseMetadata: {
                  totalDevicesQueried: deviceIds.length,
                  onlineDevicesQueried: strategy.devices.length,
                  positionsReceived: fallbackResult.positions.length,
                  emptyResponseCount: this.consecutiveEmptyResponses,
                  fallbackStrategy: strategy.name
                }
              };
            }
          } catch (error) {
            console.error(`GPS51LiveDataEnhancer: Fallback strategy "${strategy.name}" failed:`, error);
            continue; // Try next strategy
          }
        }
        
        // All strategies failed
        return {
          positions: [],
          lastQueryTime: this.lastQueryPositionTime || GPS51TimeManager.getCurrentUtcTimestamp(),
          hasNewData: false,
          serverTimeDrift: 0,
          responseMetadata: {
            totalDevicesQueried: deviceIds.length,
            onlineDevicesQueried: 0,
            positionsReceived: 0,
            emptyResponseCount: this.consecutiveEmptyResponses,
            fallbackStrategy: 'AllFailed'
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

      // Timestamp validation (not too old, not in the future) - all in milliseconds
      const positionTime = position.updatetime;
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const oneHourAgo = now - (60 * 60 * 1000); // 1 hour in milliseconds
      const oneMinuteInFuture = now + (60 * 1000); // 1 minute in milliseconds

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