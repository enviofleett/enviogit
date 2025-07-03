import { gps51EventBus, GPS51Event } from './GPS51EventBus';

export interface QueuedUpdate {
  id: string;
  type: 'vehicle' | 'position' | 'connection' | 'polling' | 'custom';
  priority: 'low' | 'normal' | 'high' | 'critical';
  data: any;
  timestamp: number;
  source: string;
  retryCount: number;
  maxRetries: number;
  processAfter?: number; // Delay processing until this timestamp
  batchKey?: string; // Key for batching similar updates
}

export interface BatchConfiguration {
  batchKey: string;
  maxBatchSize: number;
  maxWaitTime: number; // ms
  processor: (updates: QueuedUpdate[]) => Promise<void>;
}

export interface UpdateQueueStats {
  totalProcessed: number;
  totalFailed: number;
  currentQueueSize: number;
  averageProcessingTime: number;
  batchesProcessed: number;
  retryQueueSize: number;
  processingRate: number; // updates per second
}

export class GPS51UpdateQueue {
  private queue: QueuedUpdate[] = [];
  private retryQueue: QueuedUpdate[] = [];
  private processingQueue: QueuedUpdate[] = [];
  private batchConfigurations = new Map<string, BatchConfiguration>();
  private activeBatches = new Map<string, {
    updates: QueuedUpdate[];
    timer: NodeJS.Timeout;
    firstUpdateTime: number;
  }>();
  
  private isProcessing = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  
  private stats: UpdateQueueStats = {
    totalProcessed: 0,
    totalFailed: 0,
    currentQueueSize: 0,
    averageProcessingTime: 0,
    batchesProcessed: 0,
    retryQueueSize: 0,
    processingRate: 0
  };
  
  private processingTimes: number[] = [];
  private maxProcessingTimeHistory = 100;
  private processedInLastSecond = 0;
  private lastProcessingRateUpdate = Date.now();

  constructor() {
    this.startProcessing();
    this.setupDefaultBatchConfigurations();
  }

  private setupDefaultBatchConfigurations(): void {
    // Vehicle updates batching
    this.configureBatch('vehicle_updates', {
      maxBatchSize: 10,
      maxWaitTime: 1000,
      processor: async (updates) => {
        const vehicles = updates.map(u => u.data);
        gps51EventBus.emit('gps51.vehicles.batch_updated', vehicles, {
          source: 'update_queue',
          priority: 'normal'
        });
      }
    });

    // Position updates batching
    this.configureBatch('position_updates', {
      maxBatchSize: 20,
      maxWaitTime: 500,
      processor: async (updates) => {
        const positions = updates.map(u => u.data);
        gps51EventBus.emit('gps51.positions.batch_updated', positions, {
          source: 'update_queue',
          priority: 'high'
        });
      }
    });

    // Connection status batching (debounced)
    this.configureBatch('connection_status', {
      maxBatchSize: 1,
      maxWaitTime: 2000,
      processor: async (updates) => {
        // Use only the latest connection status
        const latest = updates[updates.length - 1];
        gps51EventBus.emit('gps51.connection.status', latest.data, {
          source: 'update_queue',
          priority: 'high'
        });
      }
    });
  }

  // Queue management
  enqueue(update: Omit<QueuedUpdate, 'id' | 'timestamp' | 'retryCount'>): string {
    const queuedUpdate: QueuedUpdate = {
      id: this.generateUpdateId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      ...update
    };

    // Check if this should be batched
    if (queuedUpdate.batchKey && this.batchConfigurations.has(queuedUpdate.batchKey)) {
      this.addToBatch(queuedUpdate);
    } else {
      this.insertUpdateByPriority(queuedUpdate);
    }

    this.updateStats();
    this.triggerProcessing();

    console.log('GPS51UpdateQueue: Update enqueued:', {
      id: queuedUpdate.id,
      type: queuedUpdate.type,
      priority: queuedUpdate.priority,
      batchKey: queuedUpdate.batchKey
    });

    return queuedUpdate.id;
  }

  private addToBatch(update: QueuedUpdate): void {
    const batchKey = update.batchKey!;
    const config = this.batchConfigurations.get(batchKey)!;
    
    let batch = this.activeBatches.get(batchKey);
    
    if (!batch) {
      // Create new batch
      batch = {
        updates: [],
        timer: setTimeout(() => this.processBatch(batchKey), config.maxWaitTime),
        firstUpdateTime: Date.now()
      };
      this.activeBatches.set(batchKey, batch);
    }
    
    batch.updates.push(update);
    
    // Process batch immediately if it reaches max size
    if (batch.updates.length >= config.maxBatchSize) {
      this.processBatch(batchKey);
    }
  }

  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.activeBatches.get(batchKey);
    if (!batch) return;
    
    const config = this.batchConfigurations.get(batchKey);
    if (!config) return;
    
    // Remove batch from active batches
    this.activeBatches.delete(batchKey);
    clearTimeout(batch.timer);
    
    if (batch.updates.length === 0) return;
    
    const startTime = Date.now();
    
    try {
      console.log('GPS51UpdateQueue: Processing batch:', {
        batchKey,
        updateCount: batch.updates.length,
        waitTime: startTime - batch.firstUpdateTime
      });
      
      await config.processor(batch.updates);
      
      this.stats.batchesProcessed++;
      this.stats.totalProcessed += batch.updates.length;
      
      // Record processing time
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
    } catch (error) {
      console.error('GPS51UpdateQueue: Batch processing failed:', {
        batchKey,
        updateCount: batch.updates.length,
        error: error instanceof Error ? error.message : error
      });
      
      // Add failed updates back to retry queue
      batch.updates.forEach(update => {
        update.retryCount++;
        if (update.retryCount <= update.maxRetries) {
          this.retryQueue.push(update);
        } else {
          this.stats.totalFailed++;
        }
      });
    }
  }

  private insertUpdateByPriority(update: QueuedUpdate): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const updatePriority = priorityOrder[update.priority];
    
    let insertIndex = this.queue.length;
    
    // Find correct insertion point based on priority
    for (let i = 0; i < this.queue.length; i++) {
      const queuedPriority = priorityOrder[this.queue[i].priority];
      if (updatePriority < queuedPriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, update);
  }

  // Processing
  private startProcessing(): void {
    // Main processing loop
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, 50); // Process every 50ms
    
    // Retry processing loop
    this.retryTimer = setInterval(() => {
      this.processRetryQueue();
    }, 5000); // Process retries every 5 seconds
    
    // Processing rate calculation
    setInterval(() => {
      this.updateProcessingRate();
    }, 1000); // Update rate every second
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      // Process multiple updates in parallel (up to 5)
      const updates = this.queue.splice(0, 5);
      this.processingQueue.push(...updates);
      
      const processingPromises = updates.map(update => this.processUpdate(update));
      await Promise.all(processingPromises);
      
    } finally {
      this.isProcessing = false;
      this.updateStats();
    }
  }

  private async processUpdate(update: QueuedUpdate): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Check if update should be delayed
      if (update.processAfter && Date.now() < update.processAfter) {
        this.queue.unshift(update); // Put back at front of queue
        return;
      }
      
      // Remove from processing queue
      const index = this.processingQueue.findIndex(u => u.id === update.id);
      if (index >= 0) {
        this.processingQueue.splice(index, 1);
      }
      
      // Process the update
      await this.executeUpdate(update);
      
      this.stats.totalProcessed++;
      this.processedInLastSecond++;
      
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
      console.log('GPS51UpdateQueue: Update processed:', {
        id: update.id,
        type: update.type,
        processingTime
      });
      
    } catch (error) {
      console.error('GPS51UpdateQueue: Update processing failed:', {
        id: update.id,
        type: update.type,
        retryCount: update.retryCount,
        error: error instanceof Error ? error.message : error
      });
      
      // Add to retry queue if retries remain
      update.retryCount++;
      if (update.retryCount <= update.maxRetries) {
        this.retryQueue.push(update);
      } else {
        this.stats.totalFailed++;
      }
    }
  }

  private async executeUpdate(update: QueuedUpdate): Promise<void> {
    // Emit event based on update type
    switch (update.type) {
      case 'vehicle':
        gps51EventBus.emit('gps51.vehicles.updated', update.data, {
          source: update.source,
          priority: update.priority
        });
        break;
        
      case 'position':
        gps51EventBus.emit('gps51.positions.updated', update.data, {
          source: update.source,
          priority: update.priority
        });
        break;
        
      case 'connection':
        gps51EventBus.emit('gps51.connection.status', update.data, {
          source: update.source,
          priority: update.priority
        });
        break;
        
      case 'polling':
        gps51EventBus.emit('gps51.polling.status', update.data, {
          source: update.source,
          priority: update.priority
        });
        break;
        
      case 'custom':
        if (update.data.eventType && update.data.eventData) {
          gps51EventBus.emit(update.data.eventType, update.data.eventData, {
            source: update.source,
            priority: update.priority
          });
        }
        break;
        
      default:
        throw new Error(`Unknown update type: ${update.type}`);
    }
  }

  private processRetryQueue(): void {
    if (this.retryQueue.length === 0) return;
    
    console.log('GPS51UpdateQueue: Processing retry queue:', this.retryQueue.length, 'updates');
    
    // Move retry updates back to main queue with delay
    const retryUpdates = this.retryQueue.splice(0);
    
    retryUpdates.forEach(update => {
      // Add exponential backoff delay
      const delay = Math.min(1000 * Math.pow(2, update.retryCount - 1), 30000);
      update.processAfter = Date.now() + delay;
      
      this.insertUpdateByPriority(update);
    });
    
    this.updateStats();
  }

  // Configuration
  configureBatch(batchKey: string, config: Omit<BatchConfiguration, 'batchKey'>): void {
    this.batchConfigurations.set(batchKey, {
      batchKey,
      ...config
    });
    
    console.log('GPS51UpdateQueue: Batch configuration added:', batchKey);
  }

  removeBatchConfiguration(batchKey: string): boolean {
    const removed = this.batchConfigurations.delete(batchKey);
    
    // Cancel active batch if exists
    const activeBatch = this.activeBatches.get(batchKey);
    if (activeBatch) {
      clearTimeout(activeBatch.timer);
      this.activeBatches.delete(batchKey);
    }
    
    if (removed) {
      console.log('GPS51UpdateQueue: Batch configuration removed:', batchKey);
    }
    
    return removed;
  }

  // Utility methods
  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    if (this.processingTimes.length > this.maxProcessingTimeHistory) {
      this.processingTimes.shift();
    }
  }

  private updateStats(): void {
    this.stats.currentQueueSize = this.queue.length;
    this.stats.retryQueueSize = this.retryQueue.length;
    
    if (this.processingTimes.length > 0) {
      this.stats.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }
  }

  private updateProcessingRate(): void {
    this.stats.processingRate = this.processedInLastSecond;
    this.processedInLastSecond = 0;
    this.lastProcessingRateUpdate = Date.now();
  }

  // Public API
  getStats(): UpdateQueueStats {
    return { ...this.stats };
  }

  getQueueInfo() {
    return {
      mainQueue: this.queue.length,
      retryQueue: this.retryQueue.length,
      processingQueue: this.processingQueue.length,
      activeBatches: this.activeBatches.size,
      batchConfigurations: this.batchConfigurations.size
    };
  }

  pause(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    
    console.log('GPS51UpdateQueue: Processing paused');
  }

  resume(): void {
    if (!this.processingTimer) {
      this.startProcessing();
      console.log('GPS51UpdateQueue: Processing resumed');
    }
  }

  clear(): void {
    this.queue = [];
    this.retryQueue = [];
    this.processingQueue = [];
    
    // Clear active batches
    this.activeBatches.forEach(batch => clearTimeout(batch.timer));
    this.activeBatches.clear();
    
    this.updateStats();
    
    console.log('GPS51UpdateQueue: All queues cleared');
  }

  destroy(): void {
    this.pause();
    
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    
    this.clear();
    this.batchConfigurations.clear();
    
    console.log('GPS51UpdateQueue: Destroyed');
  }

  private triggerProcessing(): void {
    // Trigger immediate processing for high/critical priority updates
    const hasHighPriority = this.queue.some(u => u.priority === 'high' || u.priority === 'critical');
    
    if (hasHighPriority && !this.isProcessing) {
      setImmediate(() => this.processQueue());
    }
  }
}

// Create singleton instance
export const gps51UpdateQueue = new GPS51UpdateQueue();