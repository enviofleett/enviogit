/**
 * GPS51 Position Manager
 * Handles position fetching and retry logic
 */

import { EmergencyGPS51Client } from '../emergency/EmergencyGPS51Client';
import { LiveDataResult } from '../GPS51UnifiedLiveDataService';

export class GPS51PositionManager {
  private client: EmergencyGPS51Client;
  private lastQueryTime: number = 0;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(apiUrl: string) {
    this.client = new EmergencyGPS51Client(apiUrl);
  }

  /**
   * Fetch live positions for devices
   */
  async fetchLivePositions(deviceIds: string[]): Promise<LiveDataResult> {
    try {
      console.log('GPS51PositionManager: Fetching positions for devices:', deviceIds.length);
      
      const result = await this.client.getLastPosition(deviceIds, this.lastQueryTime);
      
      // Update last query time
      this.lastQueryTime = result.lastquerypositiontime || Date.now();
      this.retryCount = 0; // Reset retry count on success
      
      console.log('GPS51PositionManager: Fetched positions:', {
        devices: result.devices.length,
        positions: result.positions.length,
        lastQueryTime: this.lastQueryTime
      });
      
      return result;
    } catch (error) {
      console.error('GPS51PositionManager: Failed to fetch positions:', error);
      this.retryCount++;
      
      throw new Error(`Failed to fetch positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current last query time
   */
  getLastQueryTime(): number {
    return this.lastQueryTime;
  }

  /**
   * Reset query time
   */
  resetQueryTime(): void {
    this.lastQueryTime = 0;
    console.log('GPS51PositionManager: Query time reset');
  }

  /**
   * Get retry count
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

  /**
   * Calculate retry delay based on retry count
   */
  calculateRetryDelay(): number {
    return Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30 seconds
  }

  /**
   * Check if retry should be attempted
   */
  shouldRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }
}