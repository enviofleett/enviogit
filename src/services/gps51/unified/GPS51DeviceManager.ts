/**
 * GPS51 Device Manager
 * Handles device fetching and status management
 */

import { EmergencyGPS51Client } from '../emergency/EmergencyGPS51Client';
import { GPS51Vehicle, GPS51Position } from '../GPS51UnifiedLiveDataService';

export class GPS51DeviceManager {
  private devices: GPS51Vehicle[] = [];
  private client: EmergencyGPS51Client;

  constructor(apiUrl: string) {
    this.client = new EmergencyGPS51Client(apiUrl);
  }

  /**
   * Fetch user devices from GPS51 API
   */
  async fetchUserDevices(username: string): Promise<GPS51Vehicle[]> {
    try {
      console.log('GPS51DeviceManager: Fetching devices for user:', username);
      
      const devices = await this.client.getDeviceList(username, false);
      this.devices = devices;
      
      console.log('GPS51DeviceManager: Fetched devices:', devices.length);
      return devices;
    } catch (error) {
      console.error('GPS51DeviceManager: Failed to fetch devices:', error);
      throw new Error(`Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update device status with position data
   */
  updateDeviceStatus(deviceId: string, position: GPS51Position): void {
    const device = this.devices.find(d => d.deviceid === deviceId);
    if (device) {
      device.position = position;
      device.speed = position.speed || 0;
      device.isMoving = (position.speed || 0) > 5; // Moving if speed > 5 km/h
      device.lastUpdate = new Date();
      device.status = 'online';
    }
  }

  /**
   * Get all devices
   */
  getDevices(): GPS51Vehicle[] {
    return this.devices;
  }

  /**
   * Get device count
   */
  getDeviceCount(): number {
    return this.devices.length;
  }

  /**
   * Get moving devices
   */
  getMovingDevices(): GPS51Vehicle[] {
    return this.devices.filter(device => device.isMoving);
  }

  /**
   * Get stationary devices
   */
  getStationaryDevices(): GPS51Vehicle[] {
    return this.devices.filter(device => !device.isMoving && device.status !== 'offline');
  }

  /**
   * Get offline devices
   */
  getOfflineDevices(): GPS51Vehicle[] {
    return this.devices.filter(device => device.status === 'offline');
  }

  /**
   * Clear all devices
   */
  clearDevices(): void {
    this.devices = [];
    console.log('GPS51DeviceManager: Devices cleared');
  }
}