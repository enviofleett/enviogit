/**
 * GPS51 Device Manager
 * Handles device list fetching and management
 */

import { EmergencyGPS51Client } from '../emergency/EmergencyGPS51Client';
import { GPS51Vehicle } from '../GPS51UnifiedLiveDataService';

export class GPS51DeviceManager {
  private devices: GPS51Vehicle[] = [];
  private client: EmergencyGPS51Client;

  constructor(apiUrl: string) {
    this.client = new EmergencyGPS51Client(apiUrl);
  }

  /**
   * Fetch user's affiliated devices (vehicles)
   * Implements querymonitorlist API call
   */
  async fetchUserDevices(username: string): Promise<GPS51Vehicle[]> {
    if (!username) {
      throw new Error('Username is required for device list query');
    }

    try {
      console.log('GPS51DeviceManager: Fetching user devices for', username);
      
      const deviceResponse = await this.client.getDeviceList(username);
      
      // Extract devices from response structure
      let devices: any[] = [];
      
      if (deviceResponse.groups && Array.isArray(deviceResponse.groups)) {
        // Extract devices from groups structure
        deviceResponse.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            devices = devices.concat(group.devices);
          }
        });
      } else if (deviceResponse.devices && Array.isArray(deviceResponse.devices)) {
        devices = deviceResponse.devices;
      }

      // Transform to GPS51Vehicle format
      this.devices = devices.map(device => ({
        deviceid: device.deviceid,
        devicename: device.devicename || `Device ${device.deviceid}`,
        simnum: device.simnum || '',
        lastactivetime: device.lastactivetime || '',
        isMoving: false,
        speed: 0,
        lastUpdate: new Date(),
        status: 'unknown'
      }));

      console.log('GPS51DeviceManager: Retrieved', this.devices.length, 'devices');
      return this.devices;

    } catch (error) {
      console.error('GPS51DeviceManager: Failed to fetch devices:', error);
      throw error;
    }
  }

  /**
   * Get current devices
   */
  getDevices(): GPS51Vehicle[] {
    return [...this.devices];
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): GPS51Vehicle | undefined {
    return this.devices.find(device => device.deviceid === deviceId);
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
   * Update device status from position data
   */
  updateDeviceStatus(deviceId: string, position: any): void {
    const device = this.devices.find(d => d.deviceid === deviceId);
    if (device) {
      device.position = position;
      device.isMoving = position ? position.moving === 1 : false;
      device.speed = position ? position.speed : 0;
      device.lastUpdate = new Date();
      device.status = position ? position.strstatusen : 'offline';
    }
  }

  /**
   * Clear all devices
   */
  clearDevices(): void {
    this.devices = [];
  }
}