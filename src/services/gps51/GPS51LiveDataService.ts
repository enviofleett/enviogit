
import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device, GPS51Position, GPS51Group } from './types';

export interface LiveDataState {
  lastQueryPositionTime: number;
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastUpdate: Date;
}

export interface LiveDataServiceOptions {
  pollingInterval?: number;
  maxRetries?: number;
  enableIntelligentPolling?: boolean;
}

export class GPS51LiveDataService {
  private static instance: GPS51LiveDataService;
  private client: GPS51Client;
  private state: LiveDataState;
  private pollingTimer: NodeJS.Timeout | null = null;
  private options: LiveDataServiceOptions;
  private retryCount = 0;

  private constructor(options: LiveDataServiceOptions = {}) {
    this.client = gps51Client;
    this.state = {
      lastQueryPositionTime: 0,
      devices: [],
      positions: [],
      lastUpdate: new Date()
    };
    this.options = {
      pollingInterval: 30000, // 30 seconds default
      maxRetries: 3,
      enableIntelligentPolling: true,
      ...options
    };
  }

  static getInstance(options?: LiveDataServiceOptions): GPS51LiveDataService {
    if (!GPS51LiveDataService.instance) {
      GPS51LiveDataService.instance = new GPS51LiveDataService(options);
    }
    return GPS51LiveDataService.instance;
  }

  /**
   * Step 1: Fetch all devices for the authenticated user
   */
  private async fetchUserDevices(): Promise<GPS51Device[]> {
    try {
      console.log('GPS51LiveDataService: Fetching user devices...');
      
      const devices = await this.client.getDeviceList();
      console.log(`GPS51LiveDataService: Retrieved ${devices.length} devices`);
      
      this.state.devices = devices;
      return devices;
    } catch (error) {
      console.error('GPS51LiveDataService: Failed to fetch user devices:', error);
      throw new Error(`Failed to fetch user devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2: Fetch live positions for the specified device IDs
   */
  private async fetchLivePositions(deviceIds: string[]): Promise<{positions: GPS51Position[], lastQueryTime: number}> {
    try {
      console.log('GPS51LiveDataService: Fetching live positions for devices:', deviceIds);
      
      const positions = await this.client.getRealtimePositions(deviceIds, this.state.lastQueryPositionTime);
      
      // Note: The GPS51 API should return lastquerypositiontime in the response
      // For now, we'll use the current timestamp as fallback
      const lastQueryTime = Date.now();
      
      console.log(`GPS51LiveDataService: Retrieved ${positions.length} live positions`);
      
      return { positions, lastQueryTime };
    } catch (error) {
      console.error('GPS51LiveDataService: Failed to fetch live positions:', error);
      throw new Error(`Failed to fetch live positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main method: Implement the two-step API flow
   */
  async fetchLiveData(): Promise<LiveDataState> {
    try {
      console.log('GPS51LiveDataService: Starting live data fetch...');
      
      // Step 1: Get all user devices to obtain device IDs
      const devices = await this.fetchUserDevices();
      
      if (devices.length === 0) {
        console.warn('GPS51LiveDataService: No devices found for user');
        return this.state;
      }

      // Extract device IDs
      const deviceIds = devices.map(device => device.deviceid);
      console.log('GPS51LiveDataService: Device IDs extracted:', deviceIds);

      // Step 2: Fetch live positions for all devices
      const { positions, lastQueryTime } = await this.fetchLivePositions(deviceIds);

      // Update state
      this.state = {
        lastQueryPositionTime: lastQueryTime,
        devices,
        positions,
        lastUpdate: new Date()
      };

      console.log('GPS51LiveDataService: Live data fetch completed successfully', {
        devicesCount: devices.length,
        positionsCount: positions.length,
        lastQueryTime
      });

      this.retryCount = 0; // Reset retry count on success
      return this.state;

    } catch (error) {
      console.error('GPS51LiveDataService: Live data fetch failed:', error);
      
      if (this.retryCount < (this.options.maxRetries || 3)) {
        this.retryCount++;
        console.log(`GPS51LiveDataService: Retrying... (${this.retryCount}/${this.options.maxRetries})`);
        
        // Exponential backoff
        const delay = 1000 * Math.pow(2, this.retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.fetchLiveData();
      }

      throw error;
    }
  }

  /**
   * Start continuous polling for live data updates
   */
  startPolling(callback?: (data: LiveDataState) => void): void {
    if (this.pollingTimer) {
      console.warn('GPS51LiveDataService: Polling already active');
      return;
    }

    console.log(`GPS51LiveDataService: Starting polling every ${this.options.pollingInterval}ms`);

    const poll = async () => {
      try {
        const data = await this.fetchLiveData();
        if (callback) {
          callback(data);
        }
      } catch (error) {
        console.error('GPS51LiveDataService: Polling error:', error);
      }
    };

    // Initial fetch
    poll();

    // Set up recurring polling
    this.pollingTimer = setInterval(poll, this.options.pollingInterval);
  }

  /**
   * Stop continuous polling
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('GPS51LiveDataService: Polling stopped');
    }
  }

  /**
   * Get current live data state
   */
  getCurrentState(): LiveDataState {
    return { ...this.state };
  }

  /**
   * Update polling interval
   */
  updatePollingInterval(interval: number): void {
    this.options.pollingInterval = interval;
    
    if (this.pollingTimer) {
      this.stopPolling();
      // Restart with new interval if it was already running
      this.startPolling();
    }
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
}

// Export singleton instance
export const gps51LiveDataService = GPS51LiveDataService.getInstance();
