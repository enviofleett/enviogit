import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51ApiResponse } from './GPS51Types';

export interface RequestQueueItem {
  id: string;
  action: string;
  params: Record<string, any>;
  method: 'GET' | 'POST';
  token?: string;
  priority: 'low' | 'normal' | 'high';
  resolve: (value: GPS51ApiResponse) => void;
  reject: (reason: any) => void;
  timestamp: number;
  retryCount: number;
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerSecond: number;
  minRequestInterval: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  throttledRequests: number;
  averageResponseTime: number;
  requestsInLastMinute: number;
  circuitBreakerOpen: boolean;
  lastRequestTime: number;
}

/**
 * PHASE 1: Emergency Centralized GPS51 Request Manager
 * Consolidates all GPS51 API calls to prevent aggressive throttling
 */
export class GPS51CentralizedRequestManager {
  private static instance: GPS51CentralizedRequestManager;
  private proxyClient: GPS51ProxyClient;
  private requestQueue: RequestQueueItem[] = [];
  private processing = false;
  private rateLimitConfig: RateLimitConfig;
  private metrics: RequestMetrics;
  private requestHistory: number[] = [];
  private circuitBreakerOpenUntil = 0;
  private lastRequestTime = 0;

  private constructor() {
    this.proxyClient = GPS51ProxyClient.getInstance();
    
    // EMERGENCY RATE LIMITING - Very Conservative
    this.rateLimitConfig = {
      maxRequestsPerMinute: 10, // Severely reduced from default
      maxRequestsPerSecond: 1,  // Max 1 request per second
      minRequestInterval: 2000, // Minimum 2 seconds between requests
      circuitBreakerThreshold: 3, // Open circuit after 3 failures
      circuitBreakerTimeout: 300000 // 5 minutes circuit breaker timeout
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0,
      averageResponseTime: 0,
      requestsInLastMinute: 0,
      circuitBreakerOpen: false,
      lastRequestTime: 0
    };

    console.log('🚨 GPS51CentralizedRequestManager: EMERGENCY MODE ACTIVATED');
    console.log('📊 Rate Limits:', this.rateLimitConfig);
  }

  static getInstance(): GPS51CentralizedRequestManager {
    if (!GPS51CentralizedRequestManager.instance) {
      GPS51CentralizedRequestManager.instance = new GPS51CentralizedRequestManager();
    }
    return GPS51CentralizedRequestManager.instance;
  }

  /**
   * PHASE 1: Centralized request method - all GPS51 calls go through here
   */
  async makeRequest(
    action: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'POST',
    token?: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<GPS51ApiResponse> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      console.log(`🔄 GPS51CentralizedRequestManager: Queuing ${action} request`, {
        id: requestId,
        priority,
        queueLength: this.requestQueue.length,
        circuitOpen: this.isCircuitBreakerOpen()
      });

      // Check circuit breaker first
      if (this.isCircuitBreakerOpen()) {
        console.warn('⚡ GPS51CentralizedRequestManager: Circuit breaker OPEN - rejecting request');
        reject(new Error('GPS51 API circuit breaker is open. System is in recovery mode.'));
        return;
      }

      // Add to queue with metadata
      const queueItem: RequestQueueItem = {
        id: requestId,
        action,
        params,
        method,
        token,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0
      };

      this.requestQueue.push(queueItem);
      
      // Sort queue by priority (high first)
      this.requestQueue.sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * PHASE 1: Process request queue with strict rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`🎯 GPS51CentralizedRequestManager: Processing queue (${this.requestQueue.length} items)`);

    while (this.requestQueue.length > 0) {
      // Check circuit breaker
      if (this.isCircuitBreakerOpen()) {
        console.warn('⚡ GPS51CentralizedRequestManager: Circuit breaker OPEN during processing');
        this.rejectAllQueuedRequests('Circuit breaker is open');
        break;
      }

      // Rate limiting check
      if (!this.canMakeRequest()) {
        const waitTime = this.calculateWaitTime();
        console.log(`⏳ GPS51CentralizedRequestManager: Rate limited - waiting ${waitTime}ms`);
        await this.delay(waitTime);
        continue;
      }

      const request = this.requestQueue.shift()!;
      await this.executeRequest(request);
    }

    this.processing = false;
    console.log('✅ GPS51CentralizedRequestManager: Queue processing completed');
  }

  /**
   * PHASE 1: Execute individual request with comprehensive error handling
   */
  private async executeRequest(request: RequestQueueItem): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`📡 GPS51CentralizedRequestManager: Executing ${request.action}`, {
        id: request.id,
        priority: request.priority,
        attempt: request.retryCount + 1
      });

      // Enforce minimum interval between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.rateLimitConfig.minRequestInterval) {
        const waitTime = this.rateLimitConfig.minRequestInterval - timeSinceLastRequest;
        console.log(`⏱️ GPS51CentralizedRequestManager: Enforcing ${waitTime}ms interval`);
        await this.delay(waitTime);
      }

      // Add jitter to prevent synchronized requests
      const jitter = Math.random() * 1000; // 0-1000ms jitter
      await this.delay(jitter);

      this.lastRequestTime = Date.now();
      this.recordRequestAttempt();

      // Execute the actual request
      const response = await this.proxyClient.makeRequest(
        request.action,
        request.token || '',
        request.params,
        request.method
      );

      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);

      console.log(`✅ GPS51CentralizedRequestManager: ${request.action} successful`, {
        id: request.id,
        responseTime: `${responseTime}ms`
      });

      request.resolve(response);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`❌ GPS51CentralizedRequestManager: ${request.action} failed`, {
        id: request.id,
        error: error.message,
        attempt: request.retryCount + 1
      });

      // Check if this is a rate limiting error
      if (this.isRateLimitError(error)) {
        console.warn('🚫 GPS51CentralizedRequestManager: Rate limit detected!');
        this.metrics.throttledRequests++;
        
        // Implement exponential backoff for rate limiting
        const backoffTime = Math.min(30000, 5000 * Math.pow(2, request.retryCount)); // Max 30s
        console.log(`⏰ GPS51CentralizedRequestManager: Rate limit backoff ${backoffTime}ms`);
        
        if (request.retryCount < 3) {
          request.retryCount++;
          console.log(`🔄 GPS51CentralizedRequestManager: Retrying ${request.action} after backoff`);
          
          // Re-queue with delay
          setTimeout(() => {
            this.requestQueue.unshift(request); // Add to front for priority
            if (!this.processing) {
              this.processQueue();
            }
          }, backoffTime);
          return;
        }
      }

      this.recordFailure();
      
      // Check if we should open circuit breaker
      if (this.shouldOpenCircuitBreaker()) {
        this.openCircuitBreaker();
      }

      request.reject(error);
    }
  }

  /**
   * PHASE 1: Rate limiting checks
   */
  private canMakeRequest(): boolean {
    // Check requests per minute
    const now = Date.now();
    this.requestHistory = this.requestHistory.filter(time => now - time < 60000);
    
    if (this.requestHistory.length >= this.rateLimitConfig.maxRequestsPerMinute) {
      console.warn('⚠️ GPS51CentralizedRequestManager: Minute rate limit exceeded');
      return false;
    }

    // Check minimum interval
    if (now - this.lastRequestTime < this.rateLimitConfig.minRequestInterval) {
      return false;
    }

    return true;
  }

  private calculateWaitTime(): number {
    const now = Date.now();
    
    // Wait time based on minimum interval
    const intervalWait = Math.max(0, this.rateLimitConfig.minRequestInterval - (now - this.lastRequestTime));
    
    // Wait time based on minute rate limit
    const oldestRequest = this.requestHistory[0];
    const minuteWait = oldestRequest ? Math.max(0, 60000 - (now - oldestRequest)) : 0;
    
    return Math.max(intervalWait, minuteWait, 1000); // Minimum 1 second wait
  }

  /**
   * PHASE 1: Circuit breaker implementation
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerOpenUntil > Date.now()) {
      this.metrics.circuitBreakerOpen = true;
      return true;
    }
    
    this.metrics.circuitBreakerOpen = false;
    return false;
  }

  private shouldOpenCircuitBreaker(): boolean {
    const recentFailures = this.metrics.failedRequests;
    const totalRequests = this.metrics.totalRequests;
    
    if (totalRequests < 5) return false; // Need minimum requests
    
    const failureRate = recentFailures / totalRequests;
    return recentFailures >= this.rateLimitConfig.circuitBreakerThreshold || failureRate > 0.5;
  }

  private openCircuitBreaker(): void {
    this.circuitBreakerOpenUntil = Date.now() + this.rateLimitConfig.circuitBreakerTimeout;
    console.error('🚨 GPS51CentralizedRequestManager: CIRCUIT BREAKER OPENED');
    console.log(`⏱️ Recovery time: ${new Date(this.circuitBreakerOpenUntil).toLocaleTimeString()}`);
    
    // Reject all queued requests
    this.rejectAllQueuedRequests('Circuit breaker opened due to excessive failures');
  }

  private rejectAllQueuedRequests(reason: string): void {
    const rejectedCount = this.requestQueue.length;
    this.requestQueue.forEach(request => {
      request.reject(new Error(`GPS51 API unavailable: ${reason}`));
    });
    this.requestQueue = [];
    
    console.warn(`❌ GPS51CentralizedRequestManager: Rejected ${rejectedCount} queued requests`);
  }

  /**
   * PHASE 1: Metrics and monitoring
   */
  private recordRequestAttempt(): void {
    this.requestHistory.push(Date.now());
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = Date.now();
  }

  private recordSuccess(responseTime: number): void {
    this.metrics.successfulRequests++;
    
    // Update average response time
    const totalSuccesses = this.metrics.successfulRequests;
    this.metrics.averageResponseTime = 
      ((this.metrics.averageResponseTime * (totalSuccesses - 1)) + responseTime) / totalSuccesses;
  }

  private recordFailure(): void {
    this.metrics.failedRequests++;
  }

  private isRateLimitError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('throttle') || 
           errorMessage.includes('too many requests') ||
           errorMessage.includes('8902'); // GPS51 specific rate limit status
  }

  /**
   * PHASE 1: Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * PHASE 1: Public monitoring methods
   */
  getMetrics(): RequestMetrics & { queueLength: number; rateLimitConfig: RateLimitConfig } {
    // Update requests in last minute
    const now = Date.now();
    this.requestHistory = this.requestHistory.filter(time => now - time < 60000);
    this.metrics.requestsInLastMinute = this.requestHistory.length;

    return {
      ...this.metrics,
      queueLength: this.requestQueue.length,
      rateLimitConfig: this.rateLimitConfig
    };
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    message: string;
    canAcceptRequests: boolean;
  } {
    if (this.isCircuitBreakerOpen()) {
      return {
        status: 'critical',
        message: 'Circuit breaker is open - API is in recovery mode',
        canAcceptRequests: false
      };
    }

    const failureRate = this.metrics.totalRequests > 0 
      ? this.metrics.failedRequests / this.metrics.totalRequests 
      : 0;

    if (failureRate > 0.3) {
      return {
        status: 'degraded',
        message: 'High failure rate detected - operating with caution',
        canAcceptRequests: true
      };
    }

    if (this.requestQueue.length > 10) {
      return {
        status: 'degraded',
        message: 'Request queue is growing - possible rate limiting',
        canAcceptRequests: true
      };
    }

    return {
      status: 'healthy',
      message: 'GPS51 API manager operating normally',
      canAcceptRequests: true
    };
  }

  /**
   * PHASE 1: Emergency reset functionality
   */
  emergencyReset(): void {
    console.warn('🚨 GPS51CentralizedRequestManager: EMERGENCY RESET INITIATED');
    
    // Clear queue
    this.rejectAllQueuedRequests('Emergency reset initiated');
    
    // Reset circuit breaker
    this.circuitBreakerOpenUntil = 0;
    
    // Reset metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0,
      averageResponseTime: 0,
      requestsInLastMinute: 0,
      circuitBreakerOpen: false,
      lastRequestTime: 0
    };
    
    // Clear request history
    this.requestHistory = [];
    this.lastRequestTime = 0;
    this.processing = false;
    
    console.log('✅ GPS51CentralizedRequestManager: Emergency reset completed');
  }

  /**
   * PHASE 2: Batch request optimization (for future implementation)
   */
  async makeBatchRequest(
    requests: Array<{
      action: string;
      params: Record<string, any>;
      priority?: 'low' | 'normal' | 'high';
    }>,
    token?: string
  ): Promise<GPS51ApiResponse[]> {
    // For now, process requests sequentially through the centralized queue
    const results: GPS51ApiResponse[] = [];
    
    for (const request of requests) {
      try {
        const result = await this.makeRequest(
          request.action,
          request.params,
          'POST',
          token,
          request.priority || 'normal'
        );
        results.push(result);
      } catch (error) {
        // Continue with other requests even if one fails
        console.error(`GPS51CentralizedRequestManager: Batch request ${request.action} failed:`, error);
        results.push({
          status: -1,
          message: error.message,
          data: null
        });
      }
    }
    
    return results;
  }
}

export const gps51CentralizedRequestManager = GPS51CentralizedRequestManager.getInstance();