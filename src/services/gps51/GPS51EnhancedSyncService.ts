import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51EnhancedStateManager, EnhancedLiveDataState } from './GPS51EnhancedStateManager';
import { GPS51Device, GPS51Position } from './GPS51Types';

export interface EnhancedSyncOptions {
  pollingInterval: number;
  adaptivePolling: boolean;
  maxRetries: number;
  circuitBreakerThreshold: number;
  deviceListRefreshInterval: number;
  batchSize: number;
}

const DEFAULT_OPTIONS: EnhancedSyncOptions = {
  pollingInterval: 15000,
  adaptivePolling: true,
  maxRetries: 3,
  circuitBreakerThreshold: 5,
  deviceListRefreshInterval: 300000, // 5 minutes
  batchSize: 50
};

export class GPS51EnhancedSyncService {
  private static instance: GPS51EnhancedSyncService;
  private client: GPS51Client;
  private stateManager: GPS51EnhancedStateManager;
  private options: EnhancedSyncOptions;
  
  private pollingInterval: NodeJS.Timeout | null = null;
  private deviceRefreshInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private circuitBreakerFailures = 0;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private lastCircuitBreakerReset = 0;
  
  private pollingCallback?: (data: EnhancedLiveDataState) => void;

  constructor(options?: Partial<EnhancedSyncOptions>) {
    this.client = gps51Client;
    this.stateManager = new GPS51EnhancedStateManager();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    console.log('GPS51EnhancedSyncService: Initialized with enhanced options:', this.options);
  }

  static getInstance(options?: EnhancedSyncOptions): GPS51EnhancedSyncService {
    if (!GPS51EnhancedSyncService.instance) {
      GPS51EnhancedSyncService.instance = new GPS51EnhancedSyncService(options);
    }
    return GPS51EnhancedSyncService.instance;
  }

  /**
   * Fetch enhanced live data with circuit breaker pattern
   */
  async fetchEnhancedLiveData(): Promise<EnhancedLiveDataState> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51EnhancedSyncService: Starting enhanced live data fetch...');

      // Circuit breaker check
      if (this.circuitBreakerState === 'open') {
        const timeSinceLastReset = Date.now() - this.lastCircuitBreakerReset;
        if (timeSinceLastReset < 60000) { // 1 minute cooldown
          throw new Error('Circuit breaker is open - service temporarily unavailable');
        } else {
          this.circuitBreakerState = 'half-open';
          console.log('GPS51EnhancedSyncService: Circuit breaker moving to half-open state');
        }
      }

      // Get current state for incremental sync
      const currentState = this.stateManager.getCurrentState();
      const lastQueryTime = this.stateManager.getLastQueryTime();

      // Fetch devices (periodically refresh full list)
      let devices = currentState.devices;
      const deviceListAge = Date.now() - currentState.lastUpdate.getTime();
      
      if (devices.length === 0 || deviceListAge > this.options.deviceListRefreshInterval) {
        console.log('GPS51EnhancedSyncService: Refreshing device list...');
        try {
          devices = await this.client.getDeviceList();
          console.log(`GPS51EnhancedSyncService: Retrieved ${devices.length} devices`);
        } catch (error) {
          console.warn('GPS51EnhancedSyncService: Device list refresh failed, using cached devices:', error);
          devices = currentState.devices;
        }
      }

      // Fetch positions using intelligent batching
      console.log('GPS51EnhancedSyncService: Fetching positions with batching...');
      const { positions, serverLastQueryTime } = await this.fetchPositionsInBatches(devices, lastQueryTime);

      const responseTime = Date.now() - startTime;

      console.log('GPS51EnhancedSyncService: Enhanced live data fetch completed', {
        devicesCount: devices.length,
        positionsCount: positions.length,
        responseTime,
        serverTimestamp: new Date(serverLastQueryTime).toISOString(),
        circuitBreakerState: this.circuitBreakerState
      });

      // Update state manager
      this.stateManager.updateState(devices, positions, serverLastQueryTime, responseTime);

      // Reset circuit breaker on success
      this.circuitBreakerFailures = 0;
      this.circuitBreakerState = 'closed';

      return this.stateManager.getCurrentState();
    } catch (error) {
      console.error('GPS51EnhancedSyncService: Enhanced live data fetch failed:', error);
      
      // Update circuit breaker
      this.circuitBreakerFailures++;
      if (this.circuitBreakerFailures >= this.options.circuitBreakerThreshold) {
        this.circuitBreakerState = 'open';
        this.lastCircuitBreakerReset = Date.now();
        console.warn('GPS51EnhancedSyncService: Circuit breaker opened due to repeated failures');
      }

      // Record failed sync
      this.stateManager.recordFailedSync();

      throw error;
    }
  }

  /**
   * Fetch positions in intelligent batches to optimize performance
   */
  private async fetchPositionsInBatches(devices: GPS51Device[], lastQueryTime: number): Promise<{
    positions: GPS51Position[];
    serverLastQueryTime: number;
  }> {
    const deviceIds = devices.map(d => d.deviceid);
    
    if (deviceIds.length === 0) {
      console.log('GPS51EnhancedSyncService: No devices available for position fetch');
      return { positions: [], serverLastQueryTime: lastQueryTime || Date.now() };
    }

    // For performance, fetch all positions at once if device count is reasonable
    if (deviceIds.length <= this.options.batchSize) {
      console.log(`GPS51EnhancedSyncService: Fetching positions for ${deviceIds.length} devices in single request`);
      const result = await this.client.getRealtimePositions(deviceIds, lastQueryTime);
      return {
        positions: result.positions,
        serverLastQueryTime: result.lastQueryTime
      };
    }

    // Batch processing for large fleets
    console.log(`GPS51EnhancedSyncService: Processing ${deviceIds.length} devices in batches of ${this.options.batchSize}`);
    
    const batches = [];
    for (let i = 0; i < deviceIds.length; i += this.options.batchSize) {
      batches.push(deviceIds.slice(i, i + this.options.batchSize));
    }

    let allPositions: GPS51Position[] = [];
    let latestServerTime = lastQueryTime;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      try {
        console.log(`GPS51EnhancedSyncService: Processing batch ${i + 1}/${batches.length} with ${batch.length} devices`);
        
        const result = await this.client.getRealtimePositions(batch, lastQueryTime);
        allPositions = allPositions.concat(result.positions);
        
        // Use the latest server timestamp
        if (result.lastQueryTime > latestServerTime) {
          latestServerTime = result.lastQueryTime;
        }

        console.log(`GPS51EnhancedSyncService: Processed batch ${i + 1}/${batches.length}`);
        
        // Small delay between batches to avoid overwhelming the API
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`GPS51EnhancedSyncService: Batch ${i + 1} failed:`, error);
        // Continue with other batches
      }
    }

    return {
      positions: allPositions,
      serverLastQueryTime: latestServerTime
    };
  }

  /**
   * Start enhanced polling with adaptive intervals
   */
  startEnhancedPolling(callback?: (data: EnhancedLiveDataState) => void): void {
    if (this.isPolling) {
      console.log('GPS51EnhancedSyncService: Enhanced polling already active');
      return;
    }

    this.isPolling = true;
    this.pollingCallback = callback;

    console.log('GPS51EnhancedSyncService: Starting enhanced polling with adaptive intervals...');

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        const data = await this.fetchEnhancedLiveData();
        
        if (this.pollingCallback) {
          this.pollingCallback(data);
        }

        // Adaptive interval based on activity
        const recommendedInterval = this.options.adaptivePolling ? 
          this.stateManager.getRecommendedPollingInterval() : 
          this.options.pollingInterval;

        this.pollingInterval = setTimeout(poll, recommendedInterval);
      } catch (error) {
        console.error('GPS51EnhancedSyncService: Polling iteration failed:', error);
        
        // Retry with exponential backoff
        const backoffInterval = Math.min(this.options.pollingInterval * 2, 60000);
        this.pollingInterval = setTimeout(poll, backoffInterval);
      }
    };

    // Start device list refresh interval
    console.log(`GPS51EnhancedSyncService: Starting device list refresh every ${this.options.deviceListRefreshInterval / 1000}s`);
    this.deviceRefreshInterval = setInterval(async () => {
      if (this.isPolling) {
        try {
          console.log('GPS51EnhancedSyncService: Refreshing device list...');
          const devices = await this.client.getDeviceList();
          
          // Update state if we got devices
          if (devices.length > 0) {
            const currentState = this.stateManager.getCurrentState();
            this.stateManager.updateState(devices, currentState.positions, currentState.lastQueryPositionTime);
            console.log(`GPS51EnhancedSyncService: Device list refreshed - found ${devices.length} devices`);
          }
        } catch (error) {
          console.error('GPS51EnhancedSyncService: Device list refresh failed:', error);
        }
      }
    }, this.options.deviceListRefreshInterval);

    // Start first poll
    poll();
  }

  /**
   * Stop enhanced polling
   */
  stopEnhancedPolling(): void {
    if (!this.isPolling) return;

    this.isPolling = false;
    
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.deviceRefreshInterval) {
      clearInterval(this.deviceRefreshInterval);
      this.deviceRefreshInterval = null;
    }

    console.log('GPS51EnhancedSyncService: Enhanced polling stopped');
  }

  /**
   * Get current enhanced state
   */
  getCurrentEnhancedState(): EnhancedLiveDataState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Get service status with enhanced metrics
   */
  getEnhancedServiceStatus() {
    const syncMetrics = this.stateManager.getSyncMetrics();
    
    return {
      polling: {
        isActive: this.isPolling,
        currentInterval: this.stateManager.getRecommendedPollingInterval(),
        circuitState: this.circuitBreakerState,
        circuitFailures: this.circuitBreakerFailures
      },
      sync: {
        ...syncMetrics,
        averageResponseTime: syncMetrics.averageResponseTime || 0
      },
      performance: {
        adaptivePolling: this.options.adaptivePolling,
        batchSize: this.options.batchSize,
        deviceRefreshInterval: this.options.deviceListRefreshInterval
      }
    };
  }

  /**
   * Reset service state
   */
  resetEnhancedService(): void {
    this.stopEnhancedPolling();
    this.stateManager.clearState();
    this.circuitBreakerFailures = 0;
    this.circuitBreakerState = 'closed';
    this.lastCircuitBreakerReset = 0;
    
    console.log('GPS51EnhancedSyncService: Service reset completed');
  }

  /**
   * Export debug information
   */
  exportDebugInfo() {
    return {
      serviceStatus: this.getEnhancedServiceStatus(),
      stateSnapshot: this.stateManager.exportStateForDebugging(),
      options: this.options,
      isPolling: this.isPolling,
      circuitBreaker: {
        state: this.circuitBreakerState,
        failures: this.circuitBreakerFailures,
        lastReset: this.lastCircuitBreakerReset
      }
    };
  }
}

export const gps51EnhancedSyncService = GPS51EnhancedSyncService.getInstance();