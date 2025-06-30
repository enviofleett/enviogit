
import { gps51RequestManager } from './GPS51RequestManager';

interface DeviceBatch {
  devices: string[];
  priority: 'high' | 'medium' | 'low';
  lastActivity?: number;
}

interface PollingConfig {
  baseInterval: number;
  maxInterval: number;
  minInterval: number;
  maxDevicesPerBatch: number;
  adaptiveIntervals: boolean;
  intelligentFiltering: boolean;
}

export class GPS51SmartPolling {
  private static instance: GPS51SmartPolling;
  private config: PollingConfig = {
    baseInterval: 30000, // 30 seconds
    maxInterval: 300000, // 5 minutes
    minInterval: 15000, // 15 seconds
    maxDevicesPerBatch: 50, // Conservative batch size
    adaptiveIntervals: true,
    intelligentFiltering: true
  };

  private currentInterval = this.config.baseInterval;
  private lastSuccessfulPoll = 0;
  private consecutiveEmptyPolls = 0;

  private constructor() {}

  static getInstance(): GPS51SmartPolling {
    if (!GPS51SmartPolling.instance) {
      GPS51SmartPolling.instance = new GPS51SmartPolling();
    }
    return GPS51SmartPolling.instance;
  }

  /**
   * Create intelligent device batches based on activity and priority
   */
  createDeviceBatches(deviceIds: string[], deviceActivityMap: Map<string, number>): DeviceBatch[] {
    if (!this.config.intelligentFiltering) {
      return this.createSimpleBatches(deviceIds);
    }

    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const sixHoursAgo = now - (6 * 60 * 60 * 1000);

    // Categorize devices by activity level
    const highPriorityDevices: string[] = [];
    const mediumPriorityDevices: string[] = [];
    const lowPriorityDevices: string[] = [];

    deviceIds.forEach(deviceId => {
      const lastActivity = deviceActivityMap.get(deviceId) || 0;
      
      if (lastActivity > oneHourAgo) {
        highPriorityDevices.push(deviceId);
      } else if (lastActivity > sixHoursAgo) {
        mediumPriorityDevices.push(deviceId);
      } else {
        lowPriorityDevices.push(deviceId);
      }
    });

    const batches: DeviceBatch[] = [];

    // Create batches for each priority level
    batches.push(...this.createBatchesForPriority(highPriorityDevices, 'high'));
    batches.push(...this.createBatchesForPriority(mediumPriorityDevices, 'medium'));
    batches.push(...this.createBatchesForPriority(lowPriorityDevices, 'low'));

    console.log('GPS51SmartPolling: Created device batches:', {
      totalDevices: deviceIds.length,
      highPriority: highPriorityDevices.length,
      mediumPriority: mediumPriorityDevices.length,
      lowPriority: lowPriorityDevices.length,
      totalBatches: batches.length
    });

    return batches;
  }

  private createBatchesForPriority(devices: string[], priority: 'high' | 'medium' | 'low'): DeviceBatch[] {
    const batches: DeviceBatch[] = [];
    const batchSize = this.getBatchSize(priority);

    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      batches.push({
        devices: batch,
        priority
      });
    }

    return batches;
  }

  private createSimpleBatches(deviceIds: string[]): DeviceBatch[] {
    const batches: DeviceBatch[] = [];
    
    for (let i = 0; i < deviceIds.length; i += this.config.maxDevicesPerBatch) {
      const batch = deviceIds.slice(i, i + this.config.maxDevicesPerBatch);
      batches.push({
        devices: batch,
        priority: 'medium'
      });
    }

    return batches;
  }

  private getBatchSize(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return Math.min(30, this.config.maxDevicesPerBatch);
      case 'medium':
        return Math.min(50, this.config.maxDevicesPerBatch);
      case 'low':
        return Math.min(100, this.config.maxDevicesPerBatch);
      default:
        return this.config.maxDevicesPerBatch;
    }
  }

  /**
   * Calculate adaptive polling interval based on recent activity
   */
  calculateAdaptiveInterval(hasNewData: boolean): number {
    if (!this.config.adaptiveIntervals) {
      return this.config.baseInterval;
    }

    if (hasNewData) {
      // New data found - decrease interval for more frequent polling
      this.consecutiveEmptyPolls = 0;
      this.currentInterval = Math.max(
        this.currentInterval * 0.8,
        this.config.minInterval
      );
    } else {
      // No new data - increase interval to reduce load
      this.consecutiveEmptyPolls++;
      
      if (this.consecutiveEmptyPolls >= 3) {
        this.currentInterval = Math.min(
          this.currentInterval * 1.2,
          this.config.maxInterval
        );
      }
    }

    console.log('GPS51SmartPolling: Adaptive interval updated:', {
      hasNewData,
      consecutiveEmptyPolls: this.consecutiveEmptyPolls,
      newInterval: this.currentInterval
    });

    return this.currentInterval;
  }

  /**
   * Execute batched polling with intelligent request management
   */
  async executeBatchedPolling(
    batches: DeviceBatch[],
    pollingFunction: (deviceIds: string[]) => Promise<any>
  ): Promise<any[]> {
    const results: any[] = [];
    
    console.log(`GPS51SmartPolling: Starting batched polling for ${batches.length} batches`);

    for (const batch of batches) {
      try {
        const result = await gps51RequestManager.queueRequest(
          () => pollingFunction(batch.devices),
          { 
            priority: batch.priority,
            retries: batch.priority === 'high' ? 3 : 2
          }
        );
        
        results.push(result);
        
        // Add delay between batches to prevent overwhelming the server
        const batchDelay = this.getBatchDelay(batch.priority);
        await this.sleep(batchDelay);
        
      } catch (error) {
        console.error(`GPS51SmartPolling: Batch polling failed for ${batch.devices.length} devices:`, error);
        
        // Continue with other batches even if one fails
        results.push({ positions: [], error: error.message });
      }
    }

    return results;
  }

  private getBatchDelay(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1000; // 1 second between high priority batches
      case 'medium':
        return 2000; // 2 seconds between medium priority batches
      case 'low':
        return 5000; // 5 seconds between low priority batches
      default:
        return 2000;
    }
  }

  /**
   * Get recommended polling settings based on current system status
   */
  getOptimalPollingSettings(): {
    recommendedInterval: number;
    maxDevicesPerBatch: number;
    enableAdaptivePolling: boolean;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const requestManagerHealth = gps51RequestManager.getHealthStatus();
    
    let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    let recommendedInterval = this.config.baseInterval;
    let maxDevicesPerBatch = this.config.maxDevicesPerBatch;

    if (!requestManagerHealth.isHealthy) {
      systemHealth = 'poor';
      recommendedInterval = this.config.maxInterval;
      maxDevicesPerBatch = Math.floor(this.config.maxDevicesPerBatch * 0.5);
    } else if (requestManagerHealth.consecutiveFailures > 0) {
      systemHealth = 'fair';
      recommendedInterval = Math.min(this.config.baseInterval * 1.5, this.config.maxInterval);
      maxDevicesPerBatch = Math.floor(this.config.maxDevicesPerBatch * 0.7);
    } else if (requestManagerHealth.queueLength > 5) {
      systemHealth = 'good';
      recommendedInterval = Math.min(this.config.baseInterval * 1.2, this.config.maxInterval);
      maxDevicesPerBatch = Math.floor(this.config.maxDevicesPerBatch * 0.8);
    }

    return {
      recommendedInterval,
      maxDevicesPerBatch,
      enableAdaptivePolling: systemHealth !== 'poor',
      systemHealth
    };
  }

  // Configuration methods
  updateConfig(newConfig: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('GPS51SmartPolling: Configuration updated:', this.config);
  }

  getCurrentInterval(): number {
    return this.currentInterval;
  }

  resetInterval(): void {
    this.currentInterval = this.config.baseInterval;
    this.consecutiveEmptyPolls = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const gps51SmartPolling = GPS51SmartPolling.getInstance();
