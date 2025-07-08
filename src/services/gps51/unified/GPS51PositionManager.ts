/**
 * GPS51 Position Manager
 * Handles position fetching and tracking with lastquerypositiontime
 */

import { EmergencyGPS51Client } from '../emergency/EmergencyGPS51Client';
import { GPS51Position, LiveDataResult } from '../GPS51UnifiedLiveDataService';
import { gps51RequestCoordinator } from '../GPS51RequestCoordinator';

export class GPS51PositionManager {
  private lastQueryTime: number = 0;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private client: EmergencyGPS51Client;

  constructor(apiUrl: string) {
    this.client = new EmergencyGPS51Client(apiUrl);
  }

  /**
   * Fetch live positions with lastquerypositiontime tracking
   * Uses request coordinator to prevent rate limiting
   */
  async fetchLivePositions(deviceIds?: string[]): Promise<LiveDataResult> {
    try {
      // Use provided deviceIds or empty for all devices
      const targetDeviceIds = deviceIds || [];
      
      if (targetDeviceIds.length === 0) {
        return {
          vehicles: [],
          positions: [],
          lastQueryTime: this.lastQueryTime,
          isEmpty: true,
          isSuccess: true
        };
      }

      console.log('GPS51PositionManager: Fetching positions for', targetDeviceIds.length, 'devices');
      console.log('GPS51PositionManager: Using lastquerypositiontime:', this.lastQueryTime);

      // Use request coordinator instead of direct client call
      const positionResponse = await gps51RequestCoordinator.queueRequest(
        'positions',
        {
          deviceIds: targetDeviceIds,
          lastQueryTime: this.lastQueryTime
        },
        7 // High priority for live position data
      );

      // Update lastQueryTime from server response for next call
      this.lastQueryTime = (positionResponse as any).lastquerypositiontime || this.lastQueryTime;

      // Extract positions from response
      const positions: GPS51Position[] = ((positionResponse as any).records || []).map((record: any) => ({
        deviceid: record.deviceid,
        devicetime: record.devicetime || record.updatetime || 0,
        arrivedtime: record.arrivedtime,
        updatetime: record.updatetime || 0,
        callat: record.callat || 0,
        callon: record.callon || 0,
        altitude: record.altitude || 0,
        radius: record.radius || 5,
        speed: record.speed || 0,
        course: record.course || 0,
        totaldistance: record.totaldistance || 0,
        status: record.status || 0,
        moving: record.moving || 0,
        strstatus: record.strstatus || record.strstatusen || 'Unknown',
        strstatusen: record.strstatusen || 'Unknown',
        alarm: record.alarm,
        stralarm: record.stralarm,
        stralarmen: record.stralarmen || 'No alarm',
        totaloil: record.totaloil,
        temp1: record.temp1,
        temp2: record.temp2,
        voltagepercent: record.voltagepercent
      }));

      this.retryCount = 0; // Reset retry count on success

      console.log('GPS51PositionManager: Position fetch completed', {
        positionsReceived: positions.length,
        newLastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        serverTimestamp: new Date(this.lastQueryTime).toISOString()
      });

      return {
        vehicles: [], // Will be populated by calling service
        positions,
        lastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        isSuccess: true
      };

    } catch (error) {
      this.retryCount++;
      const errorMessage = error instanceof Error ? error.message : 'Position fetch failed';
      
      console.error('GPS51PositionManager: Position fetch failed:', error);
      
      return {
        vehicles: [],
        positions: [],
        lastQueryTime: this.lastQueryTime,
        isEmpty: true,
        isSuccess: false,
        error: errorMessage
      };
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  calculateRetryDelay(): number {
    if (this.retryCount === 0) return 0;
    return Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30 seconds
  }

  /**
   * Check if retry is needed and allowed
   */
  shouldRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  /**
   * Get current lastQueryTime for debugging
   */
  getLastQueryTime(): number {
    return this.lastQueryTime;
  }

  /**
   * Reset lastQueryTime to 0 for fresh start
   */
  resetQueryTime(): void {
    this.lastQueryTime = 0;
    console.log('GPS51PositionManager: Query time reset to 0');
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Reset retry count
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }
}