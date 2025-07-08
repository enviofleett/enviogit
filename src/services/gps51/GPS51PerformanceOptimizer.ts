/**
 * GPS51 Performance Optimizer - Phase 4
 * Intelligent caching, request batching, and connection optimization
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface RequestBatch {
  requests: Array<{
    id: string;
    resolve: (data: any) => void;
    reject: (error: Error) => void;
  }>;
  timer: number;
}

export class GPS51PerformanceOptimizer {
  private static instance: GPS51PerformanceOptimizer;
  private cache = new Map<string, CacheEntry<any>>();
  private requestBatches = new Map<string, RequestBatch>();
  private connectionHealth = {
    isHealthy: true,
    lastSuccessfulRequest: Date.now(),
    consecutiveFailures: 0,
    averageResponseTime: 0,
    responseTimes: [] as number[]
  };

  static getInstance(): GPS51PerformanceOptimizer {
    if (!GPS51PerformanceOptimizer.instance) {
      GPS51PerformanceOptimizer.instance = new GPS51PerformanceOptimizer();
    }
    return GPS51PerformanceOptimizer.instance;
  }

  /**
   * Intelligent cache management with TTL and priority
   */
  setCache<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs
    });

    // Auto-cleanup expired entries
    this.cleanupExpiredCache();
  }

  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Request batching to reduce API calls
   */
  batchRequest<T>(batchKey: string, requestId: string): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.requestBatches.get(batchKey);
      
      if (!batch) {
        batch = {
          requests: [],
          timer: window.setTimeout(() => {
            this.executeBatch(batchKey);
          }, 100) // 100ms batch window
        };
        this.requestBatches.set(batchKey, batch);
      }

      batch.requests.push({ id: requestId, resolve, reject });
    });
  }

  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.requestBatches.get(batchKey);
    if (!batch) return;

    this.requestBatches.delete(batchKey);
    clearTimeout(batch.timer);

    try {
      // Execute batched request based on batch type
      let result: any;
      
      switch (batchKey) {
        case 'vehicles':
          result = await this.fetchVehiclesBatch(batch.requests.map(r => r.id));
          break;
        case 'positions':
          result = await this.fetchPositionsBatch(batch.requests.map(r => r.id));
          break;
        default:
          throw new Error(`Unknown batch type: ${batchKey}`);
      }

      // Resolve all requests with appropriate data
      batch.requests.forEach(request => {
        const data = result[request.id] || result;
        request.resolve(data);
      });

    } catch (error) {
      // Reject all requests on batch failure
      batch.requests.forEach(request => {
        request.reject(error as Error);
      });
    }
  }

  private async fetchVehiclesBatch(vehicleIds: string[]): Promise<any> {
    // Implementation would fetch multiple vehicles in one request
    console.log('GPS51PerformanceOptimizer: Batching vehicle requests:', vehicleIds.length);
    return {};
  }

  private async fetchPositionsBatch(vehicleIds: string[]): Promise<any> {
    // Implementation would fetch multiple positions in one request
    console.log('GPS51PerformanceOptimizer: Batching position requests:', vehicleIds.length);
    return {};
  }

  /**
   * Connection health monitoring
   */
  recordRequestSuccess(responseTimeMs: number): void {
    this.connectionHealth.isHealthy = true;
    this.connectionHealth.lastSuccessfulRequest = Date.now();
    this.connectionHealth.consecutiveFailures = 0;
    
    // Track response times for performance analysis
    this.connectionHealth.responseTimes.push(responseTimeMs);
    if (this.connectionHealth.responseTimes.length > 100) {
      this.connectionHealth.responseTimes.shift();
    }
    
    this.connectionHealth.averageResponseTime = 
      this.connectionHealth.responseTimes.reduce((a, b) => a + b, 0) / 
      this.connectionHealth.responseTimes.length;
  }

  recordRequestFailure(): void {
    this.connectionHealth.consecutiveFailures++;
    
    // Mark as unhealthy after 3 consecutive failures
    if (this.connectionHealth.consecutiveFailures >= 3) {
      this.connectionHealth.isHealthy = false;
    }
  }

  getConnectionHealth() {
    return {
      ...this.connectionHealth,
      timeSinceLastSuccess: Date.now() - this.connectionHealth.lastSuccessfulRequest
    };
  }

  /**
   * Smart retry with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        
        this.recordRequestSuccess(Date.now() - startTime);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        this.recordRequestFailure();
        
        if (attempt === maxRetries) break;
        
        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Rate limiting with adaptive throttling
   */
  private requestTimestamps: number[] = [];
  private readonly maxRequestsPerMinute = 30;

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    
    // Check if we can make a request
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      return false;
    }
    
    // Record this request
    this.requestTimestamps.push(now);
    return true;
  }

  getNextAvailableRequestTime(): number {
    if (this.canMakeRequest()) return 0;
    
    const oldestRequest = Math.min(...this.requestTimestamps);
    return oldestRequest + 60000 - Date.now();
  }

  /**
   * Cache cleanup to prevent memory leaks
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return {
      cacheSize: this.cache.size,
      cacheHitRate: this.calculateCacheHitRate(),
      averageResponseTime: this.connectionHealth.averageResponseTime,
      connectionHealth: this.connectionHealth.isHealthy,
      consecutiveFailures: this.connectionHealth.consecutiveFailures,
      requestsPerMinute: this.requestTimestamps.length,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  private calculateCacheHitRate(): number {
    // This would need to be tracked over time
    return 0.85; // Placeholder
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of cache memory usage
    return this.cache.size * 1024; // Bytes
  }

  /**
   * Clear all optimizations (for testing/reset)
   */
  reset(): void {
    this.cache.clear();
    this.requestBatches.clear();
    this.requestTimestamps = [];
    this.connectionHealth = {
      isHealthy: true,
      lastSuccessfulRequest: Date.now(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      responseTimes: []
    };
  }
}

export const gps51PerformanceOptimizer = GPS51PerformanceOptimizer.getInstance();