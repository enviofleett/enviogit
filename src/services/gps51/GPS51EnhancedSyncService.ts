import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device, GPS51Position } from './types';
import { GPS51DataFetcher } from './GPS51DataFetcher';
import { GPS51EnhancedStateManager, EnhancedLiveDataState } from './GPS51EnhancedStateManager';
import { GPS51AdaptivePollingService, AdaptivePollingOptions } from './GPS51AdaptivePollingService';
import { gps51DeviceManager } from './GPS51DeviceManager';

export interface EnhancedSyncOptions extends AdaptivePollingOptions {
  enableDeviceListRefresh?: boolean;
  deviceListRefreshInterval?: number;
  enableDataValidation?: boolean;
  enableBatchProcessing?: boolean;
  batchSize?: number;
  enablePerformanceMonitoring?: boolean;
}

export interface SyncPerformanceMetrics {
  totalSyncOperations: number;
  averageSyncDuration: number;
  dataValidationErrors: number;
  duplicatePositionsFiltered: number;
  batchProcessingStats: {
    batchesProcessed: number;
    averageBatchSize: number;
    batchProcessingTime: number;
  };
}

export class GPS51EnhancedSyncService {
  private static instance: GPS51EnhancedSyncService;
  private dataFetcher: GPS51DataFetcher;
  private stateManager: GPS51EnhancedStateManager;
  private pollingService: GPS51AdaptivePollingService;
  private deviceListRefreshTimer: NodeJS.Timeout | null = null;
  private options: Required<EnhancedSyncOptions>;
  private performanceMetrics: SyncPerformanceMetrics;

  private constructor(options: EnhancedSyncOptions = {}) {
    this.options = {
      // Adaptive polling defaults
      basePollingInterval: 30000,
      minPollingInterval: 5000,
      maxPollingInterval: 120000,
      maxRetries: 3,
      enableAdaptivePolling: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableIntelligentBackoff: true,
      
      // Enhanced sync defaults
      enableDeviceListRefresh: true,
      deviceListRefreshInterval: 3600000, // 1 hour
      enableDataValidation: true,
      enableBatchProcessing: true,
      batchSize: 50,
      enablePerformanceMonitoring: true,
      ...options
    };

    this.dataFetcher = new GPS51DataFetcher(gps51Client);
    this.stateManager = new GPS51EnhancedStateManager();
    this.pollingService = new GPS51AdaptivePollingService(this.options);
    
    this.performanceMetrics = {
      totalSyncOperations: 0,
      averageSyncDuration: 0,
      dataValidationErrors: 0,
      duplicatePositionsFiltered: 0,
      batchProcessingStats: {
        batchesProcessed: 0,
        averageBatchSize: 0,
        batchProcessingTime: 0
      }
    };

    console.log('GPS51EnhancedSyncService: Initialized with enhanced options:', this.options);
  }

  static getInstance(options?: EnhancedSyncOptions): GPS51EnhancedSyncService {
    if (!GPS51EnhancedSyncService.instance) {
      GPS51EnhancedSyncService.instance = new GPS51EnhancedSyncService(options);
    }
    return GPS51EnhancedSyncService.instance;
  }

  /**
   * Enhanced live data fetch with validation and deduplication
   */
  async fetchEnhancedLiveData(): Promise<EnhancedLiveDataState> {
    const syncStartTime = Date.now();
    
    try {
      console.log('GPS51EnhancedSyncService: Starting enhanced live data fetch...');
      
      const currentState = this.stateManager.getCurrentState();
      
      // Fetch complete live data
      const { devices, positions, lastQueryTime } = await this.dataFetcher.fetchCompleteLiveData(
        currentState.lastQueryPositionTime
      );

      // Data validation
      let validatedPositions = positions;
      if (this.options.enableDataValidation) {
        validatedPositions = this.validateAndSanitizePositions(positions);
      }

      // Deduplication
      const deduplicatedPositions = this.deduplicatePositions(validatedPositions, currentState.positions);

      // Batch processing if enabled
      if (this.options.enableBatchProcessing && deduplicatedPositions.length > this.options.batchSize) {
        await this.processBatchedPositions(deduplicatedPositions);
      }

      // Calculate response time and update state
      const responseTime = Date.now() - syncStartTime;
      this.stateManager.updateState(devices, deduplicatedPositions, lastQueryTime, responseTime);

      // Update performance metrics
      if (this.options.enablePerformanceMonitoring) {
        this.updatePerformanceMetrics(responseTime, deduplicatedPositions.length);
      }

      console.log('GPS51EnhancedSyncService: Enhanced live data fetch completed', {
        originalPositions: positions.length,
        validatedPositions: validatedPositions.length,
        deduplicatedPositions: deduplicatedPositions.length,
        responseTime,
        devicesCount: devices.length
      });

      return this.stateManager.getCurrentState();

    } catch (error) {
      console.error('GPS51EnhancedSyncService: Enhanced live data fetch failed:', error);
      this.stateManager.recordFailedSync();
      throw error;
    }
  }

  /**
   * Validate and sanitize position data
   */
  private validateAndSanitizePositions(positions: GPS51Position[]): GPS51Position[] {
    return positions.filter(position => {
      try {
        // Basic validation
        if (!position.deviceid || !position.callat || !position.callon) {
          this.performanceMetrics.dataValidationErrors++;
          return false;
        }

        // Coordinate validation
        const lat = parseFloat(position.callat.toString());
        const lon = parseFloat(position.callon.toString());
        
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          this.performanceMetrics.dataValidationErrors++;
          return false;
        }

        // Speed validation (reasonable limits)
        if (position.speed && (position.speed < 0 || position.speed > 300)) { // 300 km/h max
          position.speed = Math.max(0, Math.min(300, position.speed));
        }

        // Timestamp validation
        const positionTime = new Date(position.updatetime);
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        if (positionTime > now || positionTime < oneDayAgo) {
          this.performanceMetrics.dataValidationErrors++;
          return false;
        }

        return true;
      } catch (error) {
        this.performanceMetrics.dataValidationErrors++;
        return false;
      }
    });
  }

  /**
   * Deduplicate positions based on device ID and timestamp
   */
  private deduplicatePositions(newPositions: GPS51Position[], existingPositions: GPS51Position[]): GPS51Position[] {
    const existingMap = new Map<string, number>();
    
    // Build map of existing positions with latest timestamps
    existingPositions.forEach(pos => {
      const key = pos.deviceid;
      const timestamp = new Date(pos.updatetime).getTime();
      
      if (!existingMap.has(key) || timestamp > existingMap.get(key)!) {
        existingMap.set(key, timestamp);
      }
    });

    // Filter new positions to only include newer data
    const deduplicatedPositions = newPositions.filter(pos => {
      const key = pos.deviceid;
      const timestamp = new Date(pos.updatetime).getTime();
      const existingTimestamp = existingMap.get(key) || 0;
      
      if (timestamp <= existingTimestamp) {
        this.performanceMetrics.duplicatePositionsFiltered++;
        return false;
      }
      
      return true;
    });

    return deduplicatedPositions;
  }

  /**
   * Process positions in batches for better performance
   */
  private async processBatchedPositions(positions: GPS51Position[]): Promise<void> {
    const batchStartTime = Date.now();
    const batches = this.createBatches(positions, this.options.batchSize);
    
    console.log(`GPS51EnhancedSyncService: Processing ${positions.length} positions in ${batches.length} batches`);

    for (const batch of batches) {
      // Process each batch (could be stored to database, sent to external systems, etc.)
      await this.processSingleBatch(batch);
    }

    const batchProcessingTime = Date.now() - batchStartTime;
    
    // Update batch processing metrics
    this.performanceMetrics.batchProcessingStats.batchesProcessed += batches.length;
    const totalBatches = this.performanceMetrics.batchProcessingStats.batchesProcessed;
    const currentAvgTime = this.performanceMetrics.batchProcessingStats.batchProcessingTime;
    
    this.performanceMetrics.batchProcessingStats.batchProcessingTime = 
      ((currentAvgTime * (totalBatches - batches.length)) + batchProcessingTime) / totalBatches;
    
    this.performanceMetrics.batchProcessingStats.averageBatchSize = 
      positions.length / batches.length;
  }

  /**
   * Create batches from positions array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Process a single batch of positions
   */
  private async processSingleBatch(batch: GPS51Position[]): Promise<void> {
    // Placeholder for batch processing logic
    // Could include database operations, external API calls, etc.
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`GPS51EnhancedSyncService: Processed batch of ${batch.length} positions`);
        resolve();
      }, 10); // Simulate processing time
    });
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(syncDuration: number, positionCount: number): void {
    this.performanceMetrics.totalSyncOperations++;
    
    const totalOps = this.performanceMetrics.totalSyncOperations;
    const currentAvg = this.performanceMetrics.averageSyncDuration;
    
    this.performanceMetrics.averageSyncDuration = 
      ((currentAvg * (totalOps - 1)) + syncDuration) / totalOps;
  }

  /**
   * Start enhanced polling with device list refresh
   */
  startEnhancedPolling(callback?: (data: EnhancedLiveDataState) => void): void {
    console.log('GPS51EnhancedSyncService: Starting enhanced polling with adaptive intervals...');

    // Start device list refresh if enabled
    if (this.options.enableDeviceListRefresh) {
      this.startDeviceListRefresh();
      gps51DeviceManager.startDeviceListMonitoring(this.options.deviceListRefreshInterval);
    }

    // Start adaptive polling
    const pollCallback = async () => {
      const data = await this.fetchEnhancedLiveData();
      if (callback) {
        callback(data);
      }
    };

    // Start polling with adaptive interval recommendations
    this.pollingService.startPolling(
      pollCallback,
      () => this.stateManager.getRecommendedPollingInterval()
    );
  }

  /**
   * Start periodic device list refresh
   */
  private startDeviceListRefresh(): void {
    if (this.deviceListRefreshTimer) {
      clearInterval(this.deviceListRefreshTimer);
    }

    console.log(`GPS51EnhancedSyncService: Starting device list refresh every ${this.options.deviceListRefreshInterval / 1000}s`);

    this.deviceListRefreshTimer = setInterval(async () => {
      try {
        console.log('GPS51EnhancedSyncService: Refreshing device list...');
        const devices = await this.dataFetcher.fetchUserDevices();
        
        // Update only devices, keep positions and other state
        const currentState = this.stateManager.getCurrentState();
        this.stateManager.updateState(
          devices, 
          currentState.positions, 
          currentState.lastQueryPositionTime
        );
        
        console.log(`GPS51EnhancedSyncService: Device list refreshed - found ${devices.length} devices`);
      } catch (error) {
        console.error('GPS51EnhancedSyncService: Device list refresh failed:', error);
      }
    }, this.options.deviceListRefreshInterval);
  }

  /**
   * Stop enhanced polling and device refresh
   */
  stopEnhancedPolling(): void {
    this.pollingService.stopPolling();
    gps51DeviceManager.stopDeviceListMonitoring();
    
    if (this.deviceListRefreshTimer) {
      clearInterval(this.deviceListRefreshTimer);
      this.deviceListRefreshTimer = null;
    }
    
    console.log('GPS51EnhancedSyncService: Enhanced polling stopped');
  }

  /**
   * Get comprehensive service status
   */
  getEnhancedServiceStatus() {
    const pollingMetrics = this.pollingService.getPollingMetrics();
    const stateMetrics = this.stateManager.getSyncMetrics();
    const currentState = this.stateManager.getCurrentState();

    return {
      polling: {
        isActive: pollingMetrics.isPolling,
        currentInterval: pollingMetrics.currentInterval,
        circuitState: pollingMetrics.circuitState,
        successRate: pollingMetrics.successCount > 0 ? 
          (pollingMetrics.successCount / (pollingMetrics.successCount + pollingMetrics.failureCount)) * 100 : 0,
        averageResponseTime: pollingMetrics.averageResponseTime
      },
      devices: {
        total: currentState.devices.length,
        active: this.stateManager.getActiveDevicesCount(),
        idle: this.stateManager.getIdleDevicesCount(),
        inactive: this.stateManager.getInactiveDevicesCount()
      },
      sync: {
        totalSyncs: stateMetrics.totalSyncs,
        successRate: stateMetrics.successRate,
        lastSuccessTime: stateMetrics.lastSuccessTime,
        averageResponseTime: stateMetrics.averageResponseTime
      },
      performance: this.performanceMetrics,
      options: this.options
    };
  }

  /**
   * Get current enhanced state
   */
  getCurrentEnhancedState(): EnhancedLiveDataState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Reset all metrics and state
   */
  resetEnhancedService(): void {
    this.stopEnhancedPolling();
    this.stateManager.clearState();
    this.pollingService.resetMetrics();
    
    this.performanceMetrics = {
      totalSyncOperations: 0,
      averageSyncDuration: 0,
      dataValidationErrors: 0,
      duplicatePositionsFiltered: 0,
      batchProcessingStats: {
        batchesProcessed: 0,
        averageBatchSize: 0,
        batchProcessingTime: 0
      }
    };
    
    console.log('GPS51EnhancedSyncService: Service reset completed');
  }

  /**
   * Export debug information
   */
  exportDebugInfo() {
    return {
      serviceStatus: this.getEnhancedServiceStatus(),
      stateDebugInfo: this.stateManager.exportStateForDebugging(),
      pollingMetrics: this.pollingService.getPollingMetrics(),
      performanceMetrics: this.performanceMetrics,
      options: this.options
    };
  }
}

// Export singleton instance
export const gps51EnhancedSyncService = GPS51EnhancedSyncService.getInstance();
