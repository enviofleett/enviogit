import { GPS51Device, GPS51Position } from './GPS51Types';

export interface LiveDataState {
  lastQueryPositionTime: number;
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastUpdate: Date;
}

export class GPS51StateManager {
  private state: LiveDataState;

  constructor() {
    this.state = {
      lastQueryPositionTime: 0,
      devices: [],
      positions: [],
      lastUpdate: new Date()
    };
  }

  /**
   * Update state with new data
   */
  updateState(devices: GPS51Device[], positions: GPS51Position[], lastQueryTime: number): void {
    this.state = {
      lastQueryPositionTime: lastQueryTime,
      devices,
      positions,
      lastUpdate: new Date()
    };
    
    console.log('GPS51StateManager: State updated', {
      devicesCount: devices.length,
      positionsCount: positions.length,
      lastQueryTime
    });
  }

  /**
   * Get current state
   */
  getCurrentState(): LiveDataState {
    return { ...this.state };
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
   * Get state statistics
   */
  getStateStats(): {totalDevices: number, totalPositions: number, lastUpdate: Date} {
    return {
      totalDevices: this.state.devices.length,
      totalPositions: this.state.positions.length,
      lastUpdate: this.state.lastUpdate
    };
  }

  /**
   * Clear all data
   */
  clearState(): void {
    this.state = {
      lastQueryPositionTime: 0,
      devices: [],
      positions: [],
      lastUpdate: new Date()
    };
    console.log('GPS51StateManager: State cleared');
  }
}