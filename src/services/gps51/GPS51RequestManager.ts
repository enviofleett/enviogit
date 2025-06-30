
interface RequestConfig {
  priority: 'high' | 'medium' | 'low';
  retries?: number;
  timeout?: number;
}

interface QueuedRequest {
  id: string;
  execute: () => Promise<any>;
  config: RequestConfig;
  timestamp: number;
  retryCount: number;
}

interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxConcurrentRequests: number;
  minDelayBetweenRequests: number;
  backoffMultiplier: number;
  maxBackoffDelay: number;
}

export class GPS51RequestManager {
  private static instance: GPS51RequestManager;
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = new Set<string>();
  private requestHistory: number[] = [];
  private isProcessing = false;
  private consecutiveFailures = 0;
  private lastRequestTime = 0;
  private currentBackoffDelay = 1000;
  private circuitBreakerOpen = false;
  private circuitBreakerResetTime = 0;

  private rateLimitConfig: RateLimitConfig = {
    maxRequestsPerMinute: 20, // Conservative limit
    maxConcurrentRequests: 3,
    minDelayBetweenRequests: 3000, // 3 seconds minimum
    backoffMultiplier: 2,
    maxBackoffDelay: 60000 // 1 minute max
  };

  private constructor() {
    this.startQueueProcessor();
    this.startHealthMonitor();
  }

  static getInstance(): GPS51RequestManager {
    if (!GPS51RequestManager.instance) {
      GPS51RequestManager.instance = new GPS51RequestManager();
    }
    return GPS51RequestManager.instance;
  }

  async queueRequest<T>(
    requestFunction: () => Promise<T>,
    config: RequestConfig = { priority: 'medium' }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      const queuedRequest: QueuedRequest = {
        id: requestId,
        execute: async () => {
          try {
            const result = await this.executeWithProtection(requestFunction);
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        config,
        timestamp: Date.now(),
        retryCount: 0
      };

      // Insert based on priority
      this.insertByPriority(queuedRequest);
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async executeWithProtection<T>(requestFunction: () => Promise<T>): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() < this.circuitBreakerResetTime) {
        throw new Error('Circuit breaker is open - API temporarily disabled');
      } else {
        this.circuitBreakerOpen = false;
        console.log('GPS51RequestManager: Circuit breaker reset - resuming requests');
      }
    }

    // Apply rate limiting delay
    await this.applyRateLimit();

    try {
      const result = await requestFunction();
      
      // Success - reset failure count and backoff
      this.consecutiveFailures = 0;
      this.currentBackoffDelay = 1000;
      this.recordSuccessfulRequest();
      
      return result;
    } catch (error) {
      this.handleRequestFailure(error);
      throw error;
    }
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitConfig.minDelayBetweenRequests) {
      const delay = this.rateLimitConfig.minDelayBetweenRequests - timeSinceLastRequest;
      await this.sleep(delay);
    }

    // Check requests per minute limit
    this.cleanupRequestHistory();
    if (this.requestHistory.length >= this.rateLimitConfig.maxRequestsPerMinute) {
      const oldestRequest = this.requestHistory[0];
      const waitTime = 60000 - (now - oldestRequest);
      if (waitTime > 0) {
        console.log(`GPS51RequestManager: Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }

    // Check concurrent requests limit
    while (this.activeRequests.size >= this.rateLimitConfig.maxConcurrentRequests) {
      await this.sleep(100);
    }

    this.lastRequestTime = Date.now();
  }

  private handleRequestFailure(error: any): void {
    this.consecutiveFailures++;
    
    console.warn(`GPS51RequestManager: Request failed (${this.consecutiveFailures} consecutive failures):`, error);

    // Apply exponential backoff
    this.currentBackoffDelay = Math.min(
      this.currentBackoffDelay * this.rateLimitConfig.backoffMultiplier,
      this.rateLimitConfig.maxBackoffDelay
    );

    // Open circuit breaker after too many failures
    if (this.consecutiveFailures >= 5) {
      this.circuitBreakerOpen = true;
      this.circuitBreakerResetTime = Date.now() + (this.currentBackoffDelay * 2);
      console.error(`GPS51RequestManager: Circuit breaker opened for ${this.currentBackoffDelay * 2}ms`);
    }
  }

  private recordSuccessfulRequest(): void {
    const now = Date.now();
    this.requestHistory.push(now);
    this.cleanupRequestHistory();
  }

  private cleanupRequestHistory(): void {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter(time => time > oneMinuteAgo);
  }

  private insertByPriority(request: QueuedRequest): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const requestPriority = priorityOrder[request.config.priority];
    
    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuePriority = priorityOrder[this.requestQueue[i].config.priority];
      if (requestPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.requestQueue.splice(insertIndex, 0, request);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        this.activeRequests.add(request.id);
        await request.execute();
      } catch (error) {
        console.error(`GPS51RequestManager: Request ${request.id} failed:`, error);
        
        // Retry logic for failed requests
        if (request.retryCount < (request.config.retries || 2)) {
          request.retryCount++;
          await this.sleep(this.currentBackoffDelay);
          this.requestQueue.unshift(request); // Put back at front for retry
        }
      } finally {
        this.activeRequests.delete(request.id);
      }

      // Add jitter to prevent thundering herd
      await this.sleep(Math.random() * 1000);
    }

    this.isProcessing = false;
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.requestQueue.length > 0) {
        this.processQueue();
      }
    }, 5000);
  }

  private startHealthMonitor(): void {
    setInterval(() => {
      this.logHealthStatus();
    }, 30000); // Every 30 seconds
  }

  private logHealthStatus(): void {
    console.log('GPS51RequestManager Health Status:', {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      requestsLastMinute: this.requestHistory.length,
      currentBackoffDelay: this.currentBackoffDelay
    });
  }

  // Public methods for monitoring
  getHealthStatus() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      requestsPerMinute: this.requestHistory.length,
      backoffDelay: this.currentBackoffDelay,
      isHealthy: !this.circuitBreakerOpen && this.consecutiveFailures < 3
    };
  }

  // Emergency controls
  pauseAllRequests(): void {
    this.circuitBreakerOpen = true;
    this.circuitBreakerResetTime = Date.now() + 300000; // 5 minute pause
    console.warn('GPS51RequestManager: All requests paused manually');
  }

  resumeRequests(): void {
    this.circuitBreakerOpen = false;
    this.consecutiveFailures = 0;
    this.currentBackoffDelay = 1000;
    console.log('GPS51RequestManager: Requests resumed manually');
  }

  adjustRateLimit(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    console.log('GPS51RequestManager: Rate limit config updated:', this.rateLimitConfig);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const gps51RequestManager = GPS51RequestManager.getInstance();
