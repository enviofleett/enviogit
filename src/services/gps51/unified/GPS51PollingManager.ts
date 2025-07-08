/**
 * GPS51 Polling Manager
 * Handles intelligent polling intervals and priority management
 */

import { GPS51Vehicle } from '../GPS51UnifiedLiveDataService';

export interface PollingStats {
  recommendedInterval: number;
  priority1Count: number;
  priority2Count: number;
  priority3Count: number;
  totalVehicles: number;
  averageSpeed: number;
}

export class GPS51PollingManager {
  private readonly MIN_INTERVAL = 30000; // 30 seconds minimum
  private readonly MAX_INTERVAL = 300000; // 5 minutes maximum
  private readonly PRODUCTION_INTERVAL = 60000; // 1 minute for production

  /**
   * Calculate optimal polling interval based on fleet activity
   */
  calculatePollingInterval(devices: GPS51Vehicle[]): number {
    if (devices.length === 0) {
      return this.PRODUCTION_INTERVAL;
    }

    const movingCount = devices.filter(d => d.isMoving).length;
    const totalCount = devices.length;
    const activityRatio = movingCount / totalCount;

    // More activity = shorter intervals
    if (activityRatio > 0.7) {
      return this.MIN_INTERVAL; // High activity
    } else if (activityRatio > 0.3) {
      return this.PRODUCTION_INTERVAL; // Moderate activity
    } else {
      return Math.min(this.MAX_INTERVAL, this.PRODUCTION_INTERVAL * 2); // Low activity
    }
  }

  /**
   * Get polling recommendation with details
   */
  getPollingRecommendation(devices: GPS51Vehicle[]) {
    const interval = this.calculatePollingInterval(devices);
    const stats = this.getPollingStats(devices);
    
    return {
      recommendedInterval: interval,
      reason: this.getPollingReason(devices),
      stats
    };
  }

  /**
   * Get detailed polling statistics
   */
  getPollingStats(devices: GPS51Vehicle[]): PollingStats {
    // PRODUCTION FIX: Handle undefined/null devices array
    if (!devices || !Array.isArray(devices)) {
      console.warn('GPS51PollingManager: getPollingStats called with invalid devices:', devices);
      return {
        recommendedInterval: this.PRODUCTION_INTERVAL,
        priority1Count: 0,
        priority2Count: 0,
        priority3Count: 0,
        totalVehicles: 0,
        averageSpeed: 0
      };
    }
    
    const moving = devices.filter(d => d.isMoving);
    const speeds = devices.map(d => d.speed || 0);
    const averageSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / (devices.length || 1);

    return {
      recommendedInterval: this.calculatePollingInterval(devices),
      priority1Count: moving.filter(d => (d.speed || 0) > 60).length, // High speed
      priority2Count: moving.filter(d => (d.speed || 0) > 30 && (d.speed || 0) <= 60).length, // Medium speed
      priority3Count: moving.filter(d => (d.speed || 0) <= 30).length, // Low speed
      totalVehicles: devices.length,
      averageSpeed: Math.round(averageSpeed)
    };
  }

  /**
   * Get priority vehicles that should be polled more frequently
   */
  getPriorityVehicles(devices: GPS51Vehicle[]): string[] {
    return devices
      .filter(d => d.isMoving && (d.speed || 0) > 30) // Moving vehicles with decent speed
      .map(d => d.deviceid);
  }

  /**
   * Check if immediate polling is recommended
   */
  shouldPollImmediately(devices: GPS51Vehicle[]): boolean {
    const highSpeedCount = devices.filter(d => (d.speed || 0) > 80).length;
    const emergencyCount = devices.filter(d => d.status === 'emergency').length;
    
    return highSpeedCount > 0 || emergencyCount > 0;
  }

  /**
   * Get reason for polling interval recommendation
   */
  private getPollingReason(devices: GPS51Vehicle[]): string {
    if (devices.length === 0) {
      return 'No vehicles - using standard interval';
    }

    const movingCount = devices.filter(d => d.isMoving).length;
    const activityRatio = movingCount / devices.length;

    if (activityRatio > 0.7) {
      return 'High fleet activity - frequent updates needed';
    } else if (activityRatio > 0.3) {
      return 'Moderate fleet activity - balanced polling';
    } else {
      return 'Low fleet activity - extended intervals to reduce API load';
    }
  }
}