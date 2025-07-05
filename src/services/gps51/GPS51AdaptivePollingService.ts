export interface AdaptivePollingOptions {
  basePollingInterval?: number;
  minPollingInterval?: number;
  maxPollingInterval?: number;
  maxRetries?: number;
  enableAdaptivePolling?: boolean;
  enableCircuitBreaker?: boolean;
  circuitBreakerThreshold?: number;
  enableIntelligentBackoff?: boolean;
}

export interface PollingMetrics {
  successCount: number;
  failureCount: number;
  lastSuccessTime: Date | null;
  lastFailureTime: Date | null;
  averageResponseTime: number;
  currentInterval: number;
  circuitState: 'closed' | 'open' | 'half-open';
}

export class GPS51AdaptivePollingService {
  private pollingTimer: NodeJS.Timeout | null = null;
  private options: Required<AdaptivePollingOptions>;
  private retryCount = 0;
  private metrics: PollingMetrics;
  private circuitOpenTime: number | null = null;

  constructor(options: AdaptivePollingOptions = {}) {
    this.options = {
      basePollingInterval: 30000, // 30 seconds
      minPollingInterval: 5000,   // 5 seconds minimum
      maxPollingInterval: 120000, // 2 minutes maximum
      maxRetries: 3,
      enableAdaptivePolling: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableIntelligentBackoff: true,
      ...options
    };

    this.metrics = {
      successCount: 0,
      failureCount: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      averageResponseTime: 0,
      currentInterval: this.options.basePollingInterval,
      circuitState: 'closed'
    };

    console.log('GPS51AdaptivePollingService: Initialized with options:', this.options);
  }

  /**
   * Start adaptive polling with circuit breaker pattern
   */
  startPolling(
    callback: () => Promise<void>,
    getRecommendedInterval?: () => number
  ): void {
    if (this.pollingTimer) {
      console.warn('GPS51AdaptivePollingService: Polling already active');
      return;
    }

    console.log('GPS51AdaptivePollingService: Starting adaptive polling...');

    const adaptivePoll = async () => {
      // Check circuit breaker state
      if (this.isCircuitOpen()) {
        console.log('GPS51AdaptivePollingService: Circuit breaker is open, skipping poll');
        return;
      }

      const startTime = Date.now();
      
      try {
        await callback();
        
        const responseTime = Date.now() - startTime;
        this.recordSuccess(responseTime);
        
        // Adaptive interval adjustment based on external recommendation
        if (this.options.enableAdaptivePolling && getRecommendedInterval) {
          const recommendedInterval = getRecommendedInterval();
          this.adjustPollingInterval(recommendedInterval);
        }
        
      } catch (error) {
        console.error('GPS51AdaptivePollingService: Polling error:', error);
        this.recordFailure();
        
        // Intelligent retry with exponential backoff
        if (this.options.enableIntelligentBackoff && this.retryCount < this.options.maxRetries) {
          await this.executeRetryWithBackoff(callback);
        }
      }
    };

    // Initial poll
    adaptivePoll();

    // Set up recurring polling with current interval
    this.scheduleNextPoll(adaptivePoll);
  }

  /**
   * Schedule next poll with current interval
   */
  private scheduleNextPoll(pollFunction: () => Promise<void>): void {
    this.pollingTimer = setTimeout(() => {
      pollFunction().then(() => {
        if (this.pollingTimer) { // Still active
          this.scheduleNextPoll(pollFunction);
        }
      });
    }, this.metrics.currentInterval);
  }

  /**
   * Execute retry with intelligent exponential backoff
   */
  private async executeRetryWithBackoff(callback: () => Promise<void>): Promise<void> {
    this.retryCount++;
    
    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, this.retryCount - 1);
    const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
    const delay = Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
    
    console.log(`GPS51AdaptivePollingService: Retrying in ${Math.round(delay)}ms (attempt ${this.retryCount}/${this.options.maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      const startTime = Date.now();
      await callback();
      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);
    } catch (error) {
      console.error(`GPS51AdaptivePollingService: Retry ${this.retryCount} failed:`, error);
      if (this.retryCount < this.options.maxRetries) {
        await this.executeRetryWithBackoff(callback);
      }
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(responseTime: number): void {
    this.metrics.successCount++;
    this.metrics.lastSuccessTime = new Date();
    this.retryCount = 0; // Reset retry count on success
    
    // Update average response time
    const totalSuccesses = this.metrics.successCount;
    this.metrics.averageResponseTime = 
      ((this.metrics.averageResponseTime * (totalSuccesses - 1)) + responseTime) / totalSuccesses;
    
    // Close circuit if it was open
    if (this.metrics.circuitState === 'open' || this.metrics.circuitState === 'half-open') {
      this.metrics.circuitState = 'closed';
      this.circuitOpenTime = null;
      console.log('GPS51AdaptivePollingService: Circuit breaker closed after successful operation');
    }
    
    console.log('GPS51AdaptivePollingService: Success recorded', {
      responseTime,
      avgResponseTime: Math.round(this.metrics.averageResponseTime),
      successCount: this.metrics.successCount,
      currentInterval: this.metrics.currentInterval
    });
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    this.metrics.failureCount++;
    this.metrics.lastFailureTime = new Date();
    
    // Check if circuit breaker should open
    if (this.options.enableCircuitBreaker && 
        this.metrics.failureCount >= this.options.circuitBreakerThreshold &&
        this.metrics.circuitState === 'closed') {
      this.openCircuit();
    }
    
    // Increase polling interval on failure (back off)
    if (this.options.enableAdaptivePolling) {
      this.metrics.currentInterval = Math.min(
        this.metrics.currentInterval * 1.5, 
        this.options.maxPollingInterval
      );
      console.log(`GPS51AdaptivePollingService: Increased polling interval to ${this.metrics.currentInterval}ms due to failure`);
    }
  }

  /**
   * Open circuit breaker
   */
  private openCircuit(): void {
    this.metrics.circuitState = 'open';
    this.circuitOpenTime = Date.now();
    console.warn('GPS51AdaptivePollingService: Circuit breaker opened due to excessive failures');
    
    // Schedule circuit recovery attempt
    setTimeout(() => {
      if (this.metrics.circuitState === 'open') {
        this.metrics.circuitState = 'half-open';
        console.log('GPS51AdaptivePollingService: Circuit breaker moved to half-open state');
      }
    }, 60000); // Try to recover after 1 minute
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(): boolean {
    return this.metrics.circuitState === 'open';
  }

  /**
   * Adjust polling interval based on recommendations
   */
  private adjustPollingInterval(recommendedInterval: number): void {
    const clampedInterval = Math.max(
      this.options.minPollingInterval,
      Math.min(recommendedInterval, this.options.maxPollingInterval)
    );
    
    if (clampedInterval !== this.metrics.currentInterval) {
      console.log(`GPS51AdaptivePollingService: Adjusting interval from ${this.metrics.currentInterval}ms to ${clampedInterval}ms`);
      this.metrics.currentInterval = clampedInterval;
      
      // Restart polling with new interval if currently running
      if (this.pollingTimer) {
        clearTimeout(this.pollingTimer);
        // Will be rescheduled by the main polling loop
      }
    }
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
      console.log('GPS51AdaptivePollingService: Adaptive polling stopped');
    }
  }

  /**
   * Force update polling interval
   */
  updatePollingInterval(interval: number): void {
    const clampedInterval = Math.max(
      this.options.minPollingInterval,
      Math.min(interval, this.options.maxPollingInterval)
    );
    
    this.metrics.currentInterval = clampedInterval;
    console.log(`GPS51AdaptivePollingService: Polling interval updated to ${clampedInterval}ms`);
  }

  /**
   * Get current polling status and metrics
   */
  getPollingMetrics(): PollingMetrics & { isPolling: boolean; options: Required<AdaptivePollingOptions> } {
    return {
      ...this.metrics,
      isPolling: this.pollingTimer !== null,
      options: this.options
    };
  }

  /**
   * Reset metrics and circuit breaker
   */
  resetMetrics(): void {
    this.metrics = {
      successCount: 0,
      failureCount: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      averageResponseTime: 0,
      currentInterval: this.options.basePollingInterval,
      circuitState: 'closed'
    };
    this.retryCount = 0;
    this.circuitOpenTime = null;
    console.log('GPS51AdaptivePollingService: Metrics and circuit breaker reset');
  }

  /**
   * Check if currently polling
   */
  isPolling(): boolean {
    return this.pollingTimer !== null;
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get failure rate percentage
   */
  getFailureRate(): number {
    const total = this.metrics.successCount + this.metrics.failureCount;
    return total > 0 ? (this.metrics.failureCount / total) * 100 : 0;
  }

  /**
   * Get success rate percentage
   */
  getSuccessRate(): number {
    const total = this.metrics.successCount + this.metrics.failureCount;
    return total > 0 ? (this.metrics.successCount / total) * 100 : 0;
  }
}