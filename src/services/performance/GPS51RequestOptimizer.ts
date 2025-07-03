// GPS51 Request Optimizer - Phase 4.1
// Request batching and optimization for GPS51 API

import { gps51PerformanceMonitor } from './GPS51PerformanceMonitor';
import { gps51EventBus } from '../gps51/realtime';

export interface BatchRequest {
  id: string;
  endpoint: string;
  params: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

export interface RequestBatch {
  id: string;
  endpoint: string;
  requests: BatchRequest[];
  scheduledAt: Date;
  executedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface OptimizationStrategy {
  batchSize: number;
  batchTimeoutMs: number;
  maxConcurrentRequests: number;
  retryAttempts: number;
  retryDelayMs: number;
  deduplicate: boolean;
  rateLimit: {
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
  };
}

export class GPS51RequestOptimizer {
  private pendingRequests = new Map<string, BatchRequest[]>();
  private activeBatches = new Map<string, RequestBatch>();
  private concurrentRequests = 0;
  private rateLimitCounters = {
    perSecond: 0,
    perMinute: 0
  };
  private requestQueue: BatchRequest[] = [];
  private processing = false;

  private strategies: Record<string, OptimizationStrategy> = {
    vehicles: {
      batchSize: 50,
      batchTimeoutMs: 2000,
      maxConcurrentRequests: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
      deduplicate: true,
      rateLimit: {
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 300
      }
    },
    positions: {
      batchSize: 100,
      batchTimeoutMs: 1000,
      maxConcurrentRequests: 5,
      retryAttempts: 2,
      retryDelayMs: 500,
      deduplicate: true,
      rateLimit: {
        maxRequestsPerSecond: 20,
        maxRequestsPerMinute: 600
      }
    },
    analytics: {
      batchSize: 20,
      batchTimeoutMs: 5000,
      maxConcurrentRequests: 2,
      retryAttempts: 3,
      retryDelayMs: 2000,
      deduplicate: false,
      rateLimit: {
        maxRequestsPerSecond: 5,
        maxRequestsPerMinute: 100
      }
    },
    default: {
      batchSize: 25,
      batchTimeoutMs: 3000,
      maxConcurrentRequests: 3,
      retryAttempts: 2,
      retryDelayMs: 1000,
      deduplicate: true,
      rateLimit: {
        maxRequestsPerSecond: 10,
        maxRequestsPerMinute: 200
      }
    }
  };

  constructor() {
    this.setupRateLimitReset();
    this.startProcessingQueue();
  }

  // Request Optimization
  async optimizedRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options?: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      timeout?: number;
      strategy?: string;
      bypassBatching?: boolean;
    }
  ): Promise<T> {
    const strategy = this.getStrategy(options?.strategy || this.getStrategyFromEndpoint(endpoint));
    
    // Check rate limits
    if (!this.checkRateLimit(strategy)) {
      throw new Error('Rate limit exceeded');
    }

    // Bypass batching for high priority or specific requests
    if (options?.bypassBatching || options?.priority === 'critical') {
      return this.executeDirectRequest<T>(endpoint, params, strategy);
    }

    // Check for duplicate requests if deduplication is enabled
    if (strategy.deduplicate) {
      const duplicateRequest = this.findDuplicateRequest(endpoint, params);
      if (duplicateRequest) {
        return duplicateRequest as Promise<T>;
      }
    }

    // Create and queue batch request
    return new Promise<T>((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateId(),
        endpoint,
        params,
        priority: options?.priority || 'medium',
        timestamp: new Date(),
        resolve,
        reject,
        timeout: options?.timeout
      };

      this.queueRequest(request, strategy);
    });
  }

  // Request Batching
  private queueRequest(request: BatchRequest, strategy: OptimizationStrategy): void {
    const endpoint = request.endpoint;
    
    if (!this.pendingRequests.has(endpoint)) {
      this.pendingRequests.set(endpoint, []);
    }

    const endpointRequests = this.pendingRequests.get(endpoint)!;
    endpointRequests.push(request);

    // Check if we should create a batch immediately
    if (endpointRequests.length >= strategy.batchSize) {
      this.createBatch(endpoint, strategy);
    } else {
      // Schedule batch creation
      this.scheduleBatchCreation(endpoint, strategy);
    }
  }

  private scheduleBatchCreation(endpoint: string, strategy: OptimizationStrategy): void {
    setTimeout(() => {
      const requests = this.pendingRequests.get(endpoint);
      if (requests && requests.length > 0) {
        this.createBatch(endpoint, strategy);
      }
    }, strategy.batchTimeoutMs);
  }

  private createBatch(endpoint: string, strategy: OptimizationStrategy): void {
    const requests = this.pendingRequests.get(endpoint) || [];
    if (requests.length === 0) return;

    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Take up to batchSize requests
    const batchRequests = sortedRequests.splice(0, strategy.batchSize);
    
    const batch: RequestBatch = {
      id: this.generateId(),
      endpoint,
      requests: batchRequests,
      scheduledAt: new Date(),
      status: 'pending'
    };

    this.activeBatches.set(batch.id, batch);
    this.requestQueue.push(...batchRequests);

    // Update pending requests
    if (sortedRequests.length > 0) {
      this.pendingRequests.set(endpoint, sortedRequests);
    } else {
      this.pendingRequests.delete(endpoint);
    }

    console.log(`GPS51RequestOptimizer: Created batch ${batch.id} with ${batchRequests.length} requests for ${endpoint}`);
  }

  // Request Execution
  private startProcessingQueue(): void {
    if (this.processing) return;
    
    this.processing = true;
    this.processNextRequest();
  }

  private async processNextRequest(): Promise<void> {
    if (this.requestQueue.length === 0) {
      this.processing = false;
      return;
    }

    // Check concurrent request limit
    const maxConcurrent = Math.max(...Object.values(this.strategies).map(s => s.maxConcurrentRequests));
    if (this.concurrentRequests >= maxConcurrent) {
      setTimeout(() => this.processNextRequest(), 100);
      return;
    }

    const request = this.requestQueue.shift()!;
    const strategy = this.getStrategy(this.getStrategyFromEndpoint(request.endpoint));

    this.concurrentRequests++;

    try {
      const result = await this.executeRequest(request, strategy);
      request.resolve(result);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.concurrentRequests--;
      setTimeout(() => this.processNextRequest(), 10);
    }
  }

  private async executeRequest(request: BatchRequest, strategy: OptimizationStrategy): Promise<any> {
    const startTime = performance.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= strategy.retryAttempts; attempt++) {
      try {
        // Apply rate limiting
        await this.enforceRateLimit(strategy);

        const result = await this.makeApiCall(request.endpoint, request.params);
        
        const duration = performance.now() - startTime;
        gps51PerformanceMonitor.recordMetric({
          name: `request_duration_${request.endpoint}`,
          category: 'api',
          value: duration,
          unit: 'ms',
          metadata: {
            attempt: attempt + 1,
            success: true
          }
        });

        this.updateRateLimitCounters();
        return result;

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < strategy.retryAttempts) {
          const delay = strategy.retryDelayMs * Math.pow(2, attempt); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const duration = performance.now() - startTime;
    gps51PerformanceMonitor.recordMetric({
      name: `request_duration_${request.endpoint}`,
      category: 'api',
      value: duration,
      unit: 'ms',
      metadata: {
        attempt: strategy.retryAttempts + 1,
        success: false,
        error: lastError?.message
      }
    });

    throw lastError || new Error('Request failed after all retries');
  }

  private async executeDirectRequest<T>(
    endpoint: string,
    params: Record<string, any>,
    strategy: OptimizationStrategy
  ): Promise<T> {
    await this.enforceRateLimit(strategy);
    const result = await this.makeApiCall(endpoint, params);
    this.updateRateLimitCounters();
    return result;
  }

  private async makeApiCall(endpoint: string, params: Record<string, any>): Promise<any> {
    // This would integrate with the actual GPS51 API client
    // For now, we'll simulate the API call
    return gps51PerformanceMonitor.trackApiCall(endpoint, async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      return { success: true, data: params, timestamp: new Date() };
    });
  }

  // Rate Limiting
  private checkRateLimit(strategy: OptimizationStrategy): boolean {
    return this.rateLimitCounters.perSecond < strategy.rateLimit.maxRequestsPerSecond &&
           this.rateLimitCounters.perMinute < strategy.rateLimit.maxRequestsPerMinute;
  }

  private async enforceRateLimit(strategy: OptimizationStrategy): Promise<void> {
    while (!this.checkRateLimit(strategy)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private updateRateLimitCounters(): void {
    this.rateLimitCounters.perSecond++;
    this.rateLimitCounters.perMinute++;
  }

  private setupRateLimitReset(): void {
    // Reset per-second counter
    setInterval(() => {
      this.rateLimitCounters.perSecond = 0;
    }, 1000);

    // Reset per-minute counter
    setInterval(() => {
      this.rateLimitCounters.perMinute = 0;
    }, 60000);
  }

  // Deduplication
  private findDuplicateRequest<T>(endpoint: string, params: Record<string, any>): Promise<T> | null {
    const paramString = JSON.stringify(params);
    
    // Check pending requests
    const pendingRequests = this.pendingRequests.get(endpoint) || [];
    const duplicate = pendingRequests.find(req => JSON.stringify(req.params) === paramString);
    
    if (duplicate) {
      // Return a promise that resolves when the duplicate request completes
      return new Promise<T>((resolve, reject) => {
        const originalResolve = duplicate.resolve;
        const originalReject = duplicate.reject;
        
        duplicate.resolve = (result: any) => {
          originalResolve(result);
          resolve(result);
        };
        
        duplicate.reject = (error: Error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    return null;
  }

  // Utility Methods
  private getStrategy(strategyName: string): OptimizationStrategy {
    return this.strategies[strategyName] || this.strategies.default;
  }

  private getStrategyFromEndpoint(endpoint: string): string {
    if (endpoint.includes('vehicle')) return 'vehicles';
    if (endpoint.includes('position')) return 'positions';
    if (endpoint.includes('analytics')) return 'analytics';
    return 'default';
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Monitoring and Analytics
  getOptimizationStats(): any {
    const totalPending = Array.from(this.pendingRequests.values())
      .reduce((sum, requests) => sum + requests.length, 0);

    return {
      pendingRequests: totalPending,
      queueSize: this.requestQueue.length,
      activeBatches: this.activeBatches.size,
      concurrentRequests: this.concurrentRequests,
      rateLimitCounters: { ...this.rateLimitCounters },
      strategies: Object.keys(this.strategies)
    };
  }

  // Configuration
  updateStrategy(strategyName: string, updates: Partial<OptimizationStrategy>): void {
    if (this.strategies[strategyName]) {
      this.strategies[strategyName] = {
        ...this.strategies[strategyName],
        ...updates
      };
      console.log(`GPS51RequestOptimizer: Updated strategy ${strategyName}`);
    }
  }

  // Public API
  getQueueStatus(): any {
    return {
      pending: this.pendingRequests.size,
      queued: this.requestQueue.length,
      active: this.concurrentRequests,
      batches: this.activeBatches.size
    };
  }

  clearQueue(): void {
    this.requestQueue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    
    this.requestQueue = [];
    this.pendingRequests.clear();
    this.activeBatches.clear();
    
    console.log('GPS51RequestOptimizer: Queue cleared');
  }

  destroy(): void {
    this.clearQueue();
    this.processing = false;
    console.log('GPS51RequestOptimizer: Destroyed');
  }
}

// Create singleton instance
export const gps51RequestOptimizer = new GPS51RequestOptimizer();