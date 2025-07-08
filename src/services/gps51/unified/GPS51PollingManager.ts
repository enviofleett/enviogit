/**
 * GPS51 Polling Manager
 * Handles intelligent polling intervals and coordination
 */

import { GPS51Vehicle } from '../GPS51UnifiedLiveDataService';

export class GPS51PollingManager {
  private devices: GPS51Vehicle[] = [];

  /**
   * Calculate smart polling interval based on vehicle activity
   * ENHANCED: 30-60 seconds minimum to prevent rate limiting
   */
  calculatePollingInterval(devices: GPS51Vehicle[]): number {
    this.devices = devices;
    
    const movingVehicles = this.devices.filter(v => v.isMoving);
    const stationaryVehicles = this.devices.filter(v => !v.isMoving && v.status !== 'offline');
    const offlineVehicles = this.devices.filter(v => v.status === 'offline');

    if (movingVehicles.length > 0) {
      return 30000; // 30 seconds for moving vehicles
    } else if (stationaryVehicles.length > 0) {
      return 45000; // 45 seconds for stationary vehicles
    } else if (offlineVehicles.length > 0) {
      return 60000; // 60 seconds for offline vehicles
    }
    
    return 60000; // Default 60 seconds
  }

  /**
   * Get polling recommendation based on fleet state
   */
  getPollingRecommendation(devices: GPS51Vehicle[]): {
    interval: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  } {
    const movingCount = devices.filter(v => v.isMoving).length;
    const stationaryCount = devices.filter(v => !v.isMoving && v.status !== 'offline').length;
    const offlineCount = devices.filter(v => v.status === 'offline').length;

    if (movingCount > 0) {
      return {
        interval: 30000,
        reason: `${movingCount} vehicles are moving`,
        priority: 'high'
      };
    }

    if (stationaryCount > 0) {
      return {
        interval: 45000,
        reason: `${stationaryCount} vehicles are stationary`,
        priority: 'medium'
      };
    }

    return {
      interval: 60000,
      reason: `${offlineCount} vehicles are offline`,
      priority: 'low'
    };
  }

  /**
   * Check if immediate polling is recommended
   */
  shouldPollImmediately(devices: GPS51Vehicle[]): boolean {
    // Poll immediately if any vehicle just started moving
    const recentlyActiveVehicles = devices.filter(vehicle => {
      const lastUpdate = vehicle.lastUpdate.getTime();
      const timeSinceUpdate = Date.now() - lastUpdate;
      return vehicle.isMoving && timeSinceUpdate < 60000; // Within last minute
    });

    return recentlyActiveVehicles.length > 0;
  }

  /**
   * Get vehicles that should be prioritized for polling
   */
  getPriorityVehicles(devices: GPS51Vehicle[]): string[] {
    return devices
      .filter(vehicle => {
        // Prioritize moving vehicles
        if (vehicle.isMoving) return true;
        
        // Prioritize vehicles that were recently active
        const timeSinceUpdate = Date.now() - vehicle.lastUpdate.getTime();
        return timeSinceUpdate < 300000; // Within last 5 minutes
      })
      .map(vehicle => vehicle.deviceid);
  }

  /**
   * Calculate delay before next poll based on current conditions
   */
  calculateNextPollDelay(
    devices: GPS51Vehicle[], 
    lastPollTime: number,
    consecutiveFailures: number = 0
  ): number {
    const baseInterval = this.calculatePollingInterval(devices);
    
    // Add exponential backoff for failures
    const failureDelay = consecutiveFailures > 0 ? 
      Math.min(5000 * Math.pow(2, consecutiveFailures), 60000) : 0;
    
    // Calculate time since last poll
    const timeSinceLastPoll = Date.now() - lastPollTime;
    const remainingDelay = Math.max(0, baseInterval - timeSinceLastPoll);
    
    return remainingDelay + failureDelay;
  }

  /**
   * Get polling statistics
   */
  getPollingStats(devices: GPS51Vehicle[]) {
    const movingVehicles = devices.filter(v => v.isMoving);
    const stationaryVehicles = devices.filter(v => !v.isMoving && v.status !== 'offline');
    const offlineVehicles = devices.filter(v => v.status === 'offline');

    return {
      total: devices.length,
      moving: movingVehicles.length,
      stationary: stationaryVehicles.length,
      offline: offlineVehicles.length,
      recommendedInterval: this.calculatePollingInterval(devices),
      lastActivityTime: Math.max(...devices.map(v => v.lastUpdate.getTime()))
    };
  }
}