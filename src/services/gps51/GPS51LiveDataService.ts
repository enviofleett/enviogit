
import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device, GPS51Position } from './types';
import { GPS51DataFetcher } from './GPS51DataFetcher';
import { GPS51StateManager, LiveDataState } from './GPS51StateManager';
import { GPS51PollingService, PollingOptions } from './GPS51PollingService';

export interface LiveDataServiceOptions extends PollingOptions {
  // Inherited from PollingOptions: pollingInterval, maxRetries, enableIntelligentPolling
}

export class GPS51LiveDataService {
  private static instance: GPS51LiveDataService;
  private dataFetcher: GPS51DataFetcher;
  private stateManager: GPS51StateManager;
  private pollingService: GPS51PollingService;

  private constructor(options: LiveDataServiceOptions = {}) {
    this.dataFetcher = new GPS51DataFetcher(gps51Client);
    this.stateManager = new GPS51StateManager();
    this.pollingService = new GPS51PollingService(options);
  }

  static getInstance(options?: LiveDataServiceOptions): GPS51LiveDataService {
    if (!GPS51LiveDataService.instance) {
      GPS51LiveDataService.instance = new GPS51LiveDataService(options);
    }
    return GPS51LiveDataService.instance;
  }

  /**
   * Main method: Fetch live data using the two-step API flow
   */
  async fetchLiveData(): Promise<LiveDataState> {
    try {
      console.log('GPS51LiveDataService: Starting live data fetch...');
      
      const currentState = this.stateManager.getCurrentState();
      
      const { devices, positions, lastQueryTime } = await this.dataFetcher.fetchCompleteLiveData(
        currentState.lastQueryPositionTime
      );

      // Update state
      this.stateManager.updateState(devices, positions, lastQueryTime);

      console.log('GPS51LiveDataService: Live data fetch completed successfully');
      this.pollingService.resetRetryCount();
      
      return this.stateManager.getCurrentState();

    } catch (error) {
      console.error('GPS51LiveDataService: Live data fetch failed:', error);
      throw error;
    }
  }

  /**
   * Start continuous polling for live data updates
   */
  startPolling(callback?: (data: LiveDataState) => void): void {
    const pollCallback = async () => {
      const data = await this.fetchLiveData();
      if (callback) {
        callback(data);
      }
    };

    this.pollingService.startPolling(pollCallback);
  }

  /**
   * Stop continuous polling
   */
  stopPolling(): void {
    this.pollingService.stopPolling();
  }

  /**
   * Get current live data state
   */
  getCurrentState(): LiveDataState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Update polling interval
   */
  updatePollingInterval(interval: number): void {
    this.pollingService.updatePollingInterval(interval);
    
    if (this.pollingService.isPolling()) {
      // Restart polling with new interval
      this.pollingService.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): GPS51Device | undefined {
    return this.stateManager.getDeviceById(deviceId);
  }

  /**
   * Get position by device ID
   */
  getPositionByDeviceId(deviceId: string): GPS51Position | undefined {
    return this.stateManager.getPositionByDeviceId(deviceId);
  }

  /**
   * Get devices with their latest positions
   */
  getDevicesWithPositions(): Array<{device: GPS51Device, position?: GPS51Position}> {
    return this.stateManager.getDevicesWithPositions();
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
      isPolling: this.pollingService.isPolling(),
      retryCount: this.pollingService.getRetryCount(),
      stateStats: this.stateManager.getStateStats()
    };
  }

  /**
   * Clear all data and reset service
   */
  reset(): void {
    this.stopPolling();
    this.stateManager.clearState();
    this.pollingService.resetRetryCount();
    console.log('GPS51LiveDataService: Service reset completed');
  }
}

// Export singleton instance
export const gps51LiveDataService = GPS51LiveDataService.getInstance();

// Re-export types for convenience
export type { LiveDataState } from './GPS51StateManager';
