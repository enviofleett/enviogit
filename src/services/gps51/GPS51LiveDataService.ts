
import { GPS51Device, GPS51Position } from './types';
import { gps51MasterPollingService } from './GPS51MasterPollingService';

export interface LiveDataServiceOptions {
  pollingInterval?: number;
  maxRetries?: number;
  enableIntelligentPolling?: boolean;
}

export interface LiveDataState {
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastQueryPositionTime: number;
  lastUpdate: Date;
}

export class GPS51LiveDataService {
  private static instance: GPS51LiveDataService;
  private sessionId: string;
  private currentState: LiveDataState;

  private constructor(options: LiveDataServiceOptions = {}) {
    this.sessionId = `live_data_${crypto.randomUUID()}`;
    this.currentState = {
      devices: [],
      positions: [],
      lastQueryPositionTime: 0,
      lastUpdate: new Date()
    };
    console.log('GPS51LiveDataService: Redirecting to unified master polling service');
  }

  static getInstance(options?: LiveDataServiceOptions): GPS51LiveDataService {
    if (!GPS51LiveDataService.instance) {
      GPS51LiveDataService.instance = new GPS51LiveDataService(options);
    }
    return GPS51LiveDataService.instance;
  }

  /**
   * Legacy method: Now uses unified master polling service
   */
  async fetchLiveData(): Promise<LiveDataState> {
    try {
      console.log('GPS51LiveDataService: Delegating to unified master polling service');
      
      // Force a poll through the master service
      await gps51MasterPollingService.forcePoll(this.sessionId);
      
      return this.currentState;
    } catch (error) {
      console.error('GPS51LiveDataService: Live data fetch failed:', error);
      throw error;
    }
  }

  /**
   * Start continuous polling - now delegates to master service
   */
  startPolling(callback?: (data: LiveDataState) => void): void {
    const dataCallback = (data: { devices: GPS51Device[]; positions: GPS51Position[]; lastQueryTime: number }) => {
      this.currentState = {
        devices: data.devices,
        positions: data.positions,
        lastQueryPositionTime: data.lastQueryTime,
        lastUpdate: new Date()
      };
      
      if (callback) {
        callback(this.currentState);
      }
    };

    gps51MasterPollingService.registerSession(
      this.sessionId,
      [], // Will be updated when devices are available
      30000, // 30 second default
      dataCallback,
      'normal'
    );
  }

  /**
   * Stop continuous polling
   */
  stopPolling(): void {
    gps51MasterPollingService.unregisterSession(this.sessionId);
  }

  /**
   * Update polling interval
   */
  updatePollingInterval(interval: number): void {
    gps51MasterPollingService.updateSession(this.sessionId, { interval });
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): GPS51Device | undefined {
    return this.currentState.devices.find(d => d.deviceid === deviceId);
  }

  /**
   * Get position by device ID
   */
  getPositionByDeviceId(deviceId: string): GPS51Position | undefined {
    return this.currentState.positions.find(p => p.deviceid === deviceId);
  }

  /**
   * Get devices with their latest positions
   */
  getDevicesWithPositions(): Array<{device: GPS51Device, position?: GPS51Position}> {
    return this.currentState.devices.map(device => ({
      device,
      position: this.currentState.positions.find(p => p.deviceid === device.deviceid)
    }));
  }

  /**
   * Get current live data state
   */
  getCurrentState(): LiveDataState {
    return this.currentState;
  }

  /**
   * Get service status information - now from master service
   */
  getServiceStatus(): {
    isPolling: boolean;
    retryCount: number;
    stateStats: {totalDevices: number, totalPositions: number, lastUpdate: Date};
  } {
    const masterStatus = gps51MasterPollingService.getStatus();
    return {
      isPolling: masterStatus.isPolling,
      retryCount: 0, // Master service handles retries
      stateStats: {
        totalDevices: this.currentState.devices.length,
        totalPositions: this.currentState.positions.length,
        lastUpdate: this.currentState.lastUpdate
      }
    };
  }

  /**
   * Clear all data and reset service
   */
  reset(): void {
    this.stopPolling();
    this.currentState = {
      devices: [],
      positions: [],
      lastQueryPositionTime: 0,
      lastUpdate: new Date()
    };
    console.log('GPS51LiveDataService: Service reset completed');
  }
}

// Export singleton instance
export const gps51LiveDataService = GPS51LiveDataService.getInstance();

// Note: Enhanced sync service removed in favor of unified coordinator approach
