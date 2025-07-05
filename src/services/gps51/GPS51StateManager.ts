
import { GPS51Device, GPS51Position } from './types';

export interface LiveDataState {
  lastQueryPositionTime: number; // Server's timestamp for next API call
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastUpdate: Date;
}

export class GPS51StateManager {
  private state: LiveDataState;

  constructor() {
    this.state = {
      lastQueryPositionTime: 0, // Start with 0 for first API call
      devices: [],
      positions: [],
      lastUpdate: new Date()
    };
  }

  /**
   * Update the complete state with proper server timestamp handling
   */
  updateState(devices: GPS51Device[], positions: GPS51Position[], serverLastQueryTime: number): void {
    // CRITICAL FIX: Use the server's lastQueryTime for timestamp continuity
    const previousTime = this.state.lastQueryPositionTime;
    
    this.state = {
      lastQueryPositionTime: serverLastQueryTime, // Server's timestamp for next call
      devices,
      positions,
      lastUpdate: new Date()
    };

    console.log('GPS51StateManager: State updated (ENHANCED)', {
      devicesCount: devices.length,
      positionsCount: positions.length,
      previousServerTime: previousTime,
      newServerTime: serverLastQueryTime,
      serverTimestamp: new Date(serverLastQueryTime).toISOString(),
      timestampProgression: serverLastQueryTime > previousTime ? 'FORWARD' : 'BACKWARD/SAME',
      isFirstUpdate: previousTime === 0
    });
  }

  /**
   * Get current state
   */
  getCurrentState(): LiveDataState {
    return { ...this.state };
  }

  /**
   * Get the server timestamp for next API call
   */
  getLastQueryTime(): number {
    return this.state.lastQueryPositionTime;
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): GPS51Device | undefined {
    return this.state.devices.find(device => device.deviceid === deviceId);
  }

  /**
   * Get position by device ID
   */
  getPositionByDeviceId(deviceId: string): GPS51Position | undefined {
    return this.state.positions.find(position => position.deviceid === deviceId);
  }

  /**
   * Get devices with their latest positions
   */
  getDevicesWithPositions(): Array<{device: GPS51Device, position?: GPS51Position}> {
    return this.state.devices.map(device => ({
      device,
      position: this.getPositionByDeviceId(device.deviceid)
    }));
  }

  /**
   * Clear all state data and reset server timestamp
   */
  clearState(): void {
    this.state = {
      lastQueryPositionTime: 0, // Reset to 0 for fresh start
      devices: [],
      positions: [],
      lastUpdate: new Date()
    };
    console.log('GPS51StateManager: State cleared - ready for fresh start');
  }

  /**
   * Get state statistics with enhanced debugging info
   */
  getStateStats(): {totalDevices: number, totalPositions: number, lastUpdate: Date, serverTimestamp: number} {
    return {
      totalDevices: this.state.devices.length,
      totalPositions: this.state.positions.length,
      lastUpdate: this.state.lastUpdate,
      serverTimestamp: this.state.lastQueryPositionTime
    };
  }
}
