
import { GPS51Device, GPS51Position } from './types';
import { gps51CoordinatorClient } from './GPS51CoordinatorClient';

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
    console.log('GPS51LiveDataService: Using coordinator client directly');
  }

  static getInstance(options?: LiveDataServiceOptions): GPS51LiveDataService {
    if (!GPS51LiveDataService.instance) {
      GPS51LiveDataService.instance = new GPS51LiveDataService(options);
    }
    return GPS51LiveDataService.instance;
  }

  /**
   * Direct API call using coordinator client
   */
  async fetchLiveData(): Promise<LiveDataState> {
    try {
      console.log('GPS51LiveDataService: Direct coordinator call');
      
      // Direct call to coordinator for positions
      const result = await gps51CoordinatorClient.getRealtimePositions([], this.currentState.lastQueryPositionTime);
      
      this.currentState = {
        devices: this.currentState.devices,
        positions: result.positions,
        lastQueryPositionTime: result.lastQueryTime,
        lastUpdate: new Date()
      };
      
      return this.currentState;
    } catch (error) {
      console.error('GPS51LiveDataService: Live data fetch failed:', error);
      throw error;
    }
  }

  /**
   * Simple polling with fixed interval
   */
  startPolling(callback?: (data: LiveDataState) => void): void {
    console.log('GPS51LiveDataService: Simple polling not implemented - use useGPS51UnifiedData hook instead');
  }

  /**
   * Stop continuous polling
   */
  stopPolling(): void {
    console.log('GPS51LiveDataService: Simple polling - use useGPS51UnifiedData hook instead');
  }

  /**
   * Update polling interval
   */
  updatePollingInterval(interval: number): void {
    console.log('GPS51LiveDataService: Use useGPS51UnifiedData hook for polling control');
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
   * Get service status information
   */
  getServiceStatus(): {
    isPolling: boolean;
    retryCount: number;
    stateStats: {totalDevices: number, totalPositions: number, lastUpdate: Date};
  } {
    return {
      isPolling: false, // Use useGPS51UnifiedData hook for polling
      retryCount: 0,
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
