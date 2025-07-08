/**
 * GPS51 Production-Ready Monitoring Service
 * Monitors rate limits, API health, and provides production-ready error handling
 */

interface MonitoringMetrics {
  rateLimitEvents: number;
  apiSuccessRate: number;
  averageResponseTime: number;
  lastRateLimitTime: number;
  consecutiveFailures: number;
  totalRequests: number;
  isHealthy: boolean;
}

interface AlertThresholds {
  maxConsecutiveFailures: number;
  minSuccessRate: number;
  maxResponseTime: number;
  rateLimitCooldown: number;
}

export class GPS51ProductionReadyMonitor {
  private static instance: GPS51ProductionReadyMonitor;
  
  private metrics: MonitoringMetrics = {
    rateLimitEvents: 0,
    apiSuccessRate: 100,
    averageResponseTime: 0,
    lastRateLimitTime: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
    isHealthy: true
  };

  private thresholds: AlertThresholds = {
    maxConsecutiveFailures: 3,
    minSuccessRate: 80, // 80% minimum success rate
    maxResponseTime: 10000, // 10 seconds max response time
    rateLimitCooldown: 300000 // 5 minutes cooldown after rate limit
  };

  private alertCallbacks = new Set<(message: string, severity: 'info' | 'warning' | 'error') => void>();
  
  private constructor() {
    console.log('📊 GPS51ProductionReadyMonitor: Initialized with production monitoring');
    this.startHealthCheck();
  }

  static getInstance(): GPS51ProductionReadyMonitor {
    if (!GPS51ProductionReadyMonitor.instance) {
      GPS51ProductionReadyMonitor.instance = new GPS51ProductionReadyMonitor();
    }
    return GPS51ProductionReadyMonitor.instance;
  }

  /**
   * Record a successful API request
   */
  recordSuccess(responseTime: number): void {
    this.metrics.totalRequests++;
    this.metrics.consecutiveFailures = 0;
    
    // Update average response time
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1); // Moving average
    }
    
    this.updateSuccessRate();
    this.checkHealth();
    
    if (responseTime > this.thresholds.maxResponseTime) {
      this.triggerAlert(`Slow API response: ${responseTime}ms`, 'warning');
    }
  }

  /**
   * Record a failed API request
   */
  recordFailure(error: any, isRateLimit: boolean = false): void {
    this.metrics.totalRequests++;
    this.metrics.consecutiveFailures++;
    
    if (isRateLimit) {
      this.metrics.rateLimitEvents++;
      this.metrics.lastRateLimitTime = Date.now();
      this.triggerAlert('GPS51 API rate limit detected - implementing backoff', 'warning');
    }
    
    this.updateSuccessRate();
    this.checkHealth();
    
    if (this.metrics.consecutiveFailures >= this.thresholds.maxConsecutiveFailures) {
      this.triggerAlert(
        `${this.metrics.consecutiveFailures} consecutive API failures detected`, 
        'error'
      );
    }
  }

  /**
   * Check if we're currently in a rate limit cooldown period
   */
  isInRateLimitCooldown(): boolean {
    if (this.metrics.lastRateLimitTime === 0) return false;
    
    const timeSinceRateLimit = Date.now() - this.metrics.lastRateLimitTime;
    return timeSinceRateLimit < this.thresholds.rateLimitCooldown;
  }

  /**
   * Get recommended action based on current system state
   */
  getRecommendedAction(): {
    action: 'normal' | 'slow_down' | 'pause' | 'fallback';
    reason: string;
    waitTime?: number;
  } {
    if (this.isInRateLimitCooldown()) {
      const remainingCooldown = this.thresholds.rateLimitCooldown - 
        (Date.now() - this.metrics.lastRateLimitTime);
      
      return {
        action: 'pause',
        reason: 'Rate limit cooldown active',
        waitTime: remainingCooldown
      };
    }

    if (this.metrics.consecutiveFailures >= this.thresholds.maxConsecutiveFailures) {
      return {
        action: 'fallback',
        reason: 'Multiple consecutive failures - use cached data',
        waitTime: 60000 // 1 minute
      };
    }

    if (this.metrics.apiSuccessRate < this.thresholds.minSuccessRate) {
      return {
        action: 'slow_down',
        reason: 'Low success rate detected',
        waitTime: 30000 // 30 seconds
      };
    }

    if (this.metrics.averageResponseTime > this.thresholds.maxResponseTime) {
      return {
        action: 'slow_down',
        reason: 'High response times detected'
      };
    }

    return {
      action: 'normal',
      reason: 'System operating normally'
    };
  }

  /**
   * Get current system metrics
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Add alert callback for notifications
   */
  addAlertCallback(callback: (message: string, severity: 'info' | 'warning' | 'error') => void): void {
    this.alertCallbacks.add(callback);
  }

  /**
   * Remove alert callback
   */
  removeAlertCallback(callback: (message: string, severity: 'info' | 'warning' | 'error') => void): void {
    this.alertCallbacks.delete(callback);
  }

  /**
   * Reset all metrics (for testing or after maintenance)
   */
  resetMetrics(): void {
    this.metrics = {
      rateLimitEvents: 0,
      apiSuccessRate: 100,
      averageResponseTime: 0,
      lastRateLimitTime: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      isHealthy: true
    };
    
    this.triggerAlert('Monitoring metrics reset', 'info');
    console.log('📊 GPS51ProductionReadyMonitor: Metrics reset');
  }

  /**
   * Update configuration thresholds
   */
  updateThresholds(newThresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('📊 GPS51ProductionReadyMonitor: Thresholds updated', this.thresholds);
  }

  // Private methods

  private updateSuccessRate(): void {
    if (this.metrics.totalRequests === 0) {
      this.metrics.apiSuccessRate = 100;
      return;
    }

    const successfulRequests = this.metrics.totalRequests - 
      (this.metrics.consecutiveFailures > 0 ? this.metrics.consecutiveFailures : 0);
    
    this.metrics.apiSuccessRate = (successfulRequests / this.metrics.totalRequests) * 100;
  }

  private checkHealth(): void {
    const wasHealthy = this.metrics.isHealthy;
    
    this.metrics.isHealthy = 
      this.metrics.consecutiveFailures < this.thresholds.maxConsecutiveFailures &&
      this.metrics.apiSuccessRate >= this.thresholds.minSuccessRate &&
      !this.isInRateLimitCooldown();

    if (wasHealthy && !this.metrics.isHealthy) {
      this.triggerAlert('GPS51 API health degraded', 'error');
    } else if (!wasHealthy && this.metrics.isHealthy) {
      this.triggerAlert('GPS51 API health restored', 'info');
    }
  }

  private triggerAlert(message: string, severity: 'info' | 'warning' | 'error'): void {
    console.log(`🚨 GPS51ProductionReadyMonitor [${severity.toUpperCase()}]: ${message}`);
    
    this.alertCallbacks.forEach(callback => {
      try {
        callback(message, severity);
      } catch (error) {
        console.error('GPS51ProductionReadyMonitor: Alert callback failed:', error);
      }
    });
  }

  private startHealthCheck(): void {
    // Periodic health check every 5 minutes
    setInterval(() => {
      const recommendation = this.getRecommendedAction();
      
      if (recommendation.action !== 'normal') {
        console.log(`📊 GPS51ProductionReadyMonitor: Health check - ${recommendation.reason}`);
      }
      
      // Log metrics summary
      console.log('📊 GPS51ProductionReadyMonitor: Metrics summary', {
        totalRequests: this.metrics.totalRequests,
        successRate: `${this.metrics.apiSuccessRate.toFixed(1)}%`,
        avgResponseTime: `${this.metrics.averageResponseTime.toFixed(0)}ms`,
        rateLimitEvents: this.metrics.rateLimitEvents,
        isHealthy: this.metrics.isHealthy
      });
    }, 300000); // 5 minutes
  }
}

// Export singleton instance
export const gps51ProductionReadyMonitor = GPS51ProductionReadyMonitor.getInstance();