import { supabase } from '@/integrations/supabase/client';

interface RateLimitState {
  lastRequestTime: number;
  consecutiveFailures: number;
  rateLimitCooldownUntil: number;
  circuitBreakerOpen: boolean;
  requestHistory: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
    action: string;
  }>;
}

export class GPS51RateLimitService {
  private static instance: GPS51RateLimitService;
  private state: RateLimitState = {
    lastRequestTime: 0,
    consecutiveFailures: 0,
    rateLimitCooldownUntil: 0,
    circuitBreakerOpen: false,
    requestHistory: []
  };

  private readonly MIN_REQUEST_SPACING = 3000; // 3 seconds
  private readonly MAX_FAILURES_THRESHOLD = 10;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly COOLDOWN_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly CIRCUIT_BREAKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  static getInstance(): GPS51RateLimitService {
    if (!GPS51RateLimitService.instance) {
      GPS51RateLimitService.instance = new GPS51RateLimitService();
    }
    return GPS51RateLimitService.instance;
  }

  async checkLimits(): Promise<{
    shouldAllow: boolean;
    reason: string;
    waitTime: number;
    message: string;
    recommendedDelay?: number;
  }> {
    const now = Date.now();

    try {
      // Check with remote rate limiter service
      const { data, error } = await supabase.functions.invoke('gps51-rate-limiter', {
        body: { action: 'check_limits' }
      });

      if (error) {
        console.warn('GPS51RateLimitService: Remote rate limiter unavailable, using local logic');
        return this.checkLocalLimits();
      }

      return data;
    } catch (error) {
      console.warn('GPS51RateLimitService: Fallback to local rate limiting');
      return this.checkLocalLimits();
    }
  }

  private checkLocalLimits(): {
    shouldAllow: boolean;
    reason: string;
    waitTime: number;
    message: string;
    recommendedDelay?: number;
  } {
    const now = Date.now();

    // Check circuit breaker
    if (this.state.circuitBreakerOpen) {
      if (now - this.state.rateLimitCooldownUntil > this.CIRCUIT_BREAKER_TIMEOUT) {
        this.state.circuitBreakerOpen = false;
        this.state.consecutiveFailures = 0;
        console.log('GPS51RateLimitService: Circuit breaker recovered');
      } else {
        return {
          shouldAllow: false,
          reason: 'circuit_breaker_open',
          waitTime: this.state.rateLimitCooldownUntil - now,
          message: 'Circuit breaker is open due to consecutive failures'
        };
      }
    }

    // Check rate limit cooldown
    if (now < this.state.rateLimitCooldownUntil) {
      const waitTime = this.state.rateLimitCooldownUntil - now;
      return {
        shouldAllow: false,
        reason: 'rate_limit_cooldown',
        waitTime,
        message: `Rate limit cooldown active. Wait ${Math.ceil(waitTime / 1000)} seconds`
      };
    }

    // Check minimum request spacing
    const timeSinceLastRequest = now - this.state.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_SPACING) {
      const waitTime = this.MIN_REQUEST_SPACING - timeSinceLastRequest;
      return {
        shouldAllow: false,
        reason: 'request_spacing',
        waitTime,
        message: `Minimum request spacing not met. Wait ${Math.ceil(waitTime / 1000)} seconds`
      };
    }

    // Check recent failure pattern
    const last15Minutes = now - (15 * 60 * 1000);
    const recentRequests = this.state.requestHistory.filter(r => r.timestamp > last15Minutes);
    const recentFailures = recentRequests.filter(r => !r.success).length;

    if (recentFailures > this.MAX_FAILURES_THRESHOLD) {
      this.state.rateLimitCooldownUntil = now + this.COOLDOWN_DURATION;
      this.logAlert('high_failure_rate', `${recentFailures} failures in last 15 minutes`);
      
      return {
        shouldAllow: false,
        reason: 'high_failure_rate',
        waitTime: this.COOLDOWN_DURATION,
        message: 'High failure rate detected. Activating 10-minute cooldown'
      };
    }

    // Allow request
    this.state.lastRequestTime = now;
    
    return {
      shouldAllow: true,
      reason: 'allowed',
      waitTime: 0,
      message: 'Request allowed',
      recommendedDelay: Math.max(this.MIN_REQUEST_SPACING - timeSinceLastRequest, 0)
    };
  }

  async recordRequest(
    action: string,
    success: boolean,
    responseTime: number,
    status?: number | string
  ): Promise<void> {
    const now = Date.now();

    // Record locally
    this.state.requestHistory.push({
      timestamp: now,
      success,
      responseTime,
      action
    });

    // Keep only last 100 requests
    if (this.state.requestHistory.length > 100) {
      this.state.requestHistory = this.state.requestHistory.slice(-100);
    }

    // Handle 8902 rate limit error specifically
    if (status === 8902 || (typeof status === 'string' && status.includes('8902'))) {
      console.warn('GPS51RateLimitService: 8902 error detected, activating immediate cooldown');
      this.state.rateLimitCooldownUntil = now + (15 * 60 * 1000); // 15 minutes
      this.state.consecutiveFailures++;
      
      this.logAlert('8902_detected', 'GPS51 8902 rate limit error detected');
      
      // Open circuit breaker if too many 8902 errors
      if (this.state.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.state.circuitBreakerOpen = true;
        this.logAlert('circuit_breaker_open', 'Circuit breaker opened due to consecutive 8902 errors');
      }
    } else if (success) {
      // Reset consecutive failures on success
      this.state.consecutiveFailures = 0;
    } else {
      // Increment failures for other errors
      this.state.consecutiveFailures++;
    }

    // Record with remote service
    try {
      await supabase.functions.invoke('gps51-rate-limiter', {
        body: {
          action: 'record_request',
          success,
          responseTime,
          status
        }
      });
    } catch (error) {
      console.warn('GPS51RateLimitService: Failed to record with remote service');
    }
  }

  async getStatus(): Promise<{
    rateLimitState: RateLimitState;
    metrics: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: number;
      averageResponseTime: number;
    };
    recommendations: {
      requestSpacing: number;
      shouldThrottle: boolean;
      riskLevel: string;
    };
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('gps51-rate-limiter', {
        body: { action: 'get_status' }
      });

      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.warn('GPS51RateLimitService: Using local status');
    }

    // Fallback to local status
    const now = Date.now();
    const last15Minutes = now - (15 * 60 * 1000);
    const recentRequests = this.state.requestHistory.filter(r => r.timestamp > last15Minutes);
    
    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    return {
      rateLimitState: {
        ...this.state,
        isInCooldown: now < this.state.rateLimitCooldownUntil,
        cooldownRemaining: Math.max(0, this.state.rateLimitCooldownUntil - now)
      } as any,
      metrics: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: Math.round(successRate),
        averageResponseTime: recentRequests.length > 0 
          ? Math.round(recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length)
          : 0
      },
      recommendations: {
        requestSpacing: this.MIN_REQUEST_SPACING,
        shouldThrottle: failedRequests > 5,
        riskLevel: failedRequests > 10 ? 'high' : failedRequests > 5 ? 'medium' : 'low'
      }
    };
  }

  async resetState(): Promise<void> {
    this.state = {
      lastRequestTime: 0,
      consecutiveFailures: 0,
      rateLimitCooldownUntil: 0,
      circuitBreakerOpen: false,
      requestHistory: []
    };

    this.logAlert('state_reset', 'Rate limiter state manually reset');

    try {
      await supabase.functions.invoke('gps51-rate-limiter', {
        body: { action: 'reset_state' }
      });
    } catch (error) {
      console.warn('GPS51RateLimitService: Failed to reset remote state');
    }
  }

  private async logAlert(type: string, message: string): Promise<void> {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: 'GPS51-RateLimiter-Local',
        method: 'ALERT',
        request_payload: { 
          alertType: type, 
          state: JSON.parse(JSON.stringify(this.state)) 
        },
        response_status: 200,
        response_body: { message },
        duration_ms: 0,
        error_message: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log rate limiter alert:', error);
    }
  }

  // Utility method for components to wait for safe request timing
  async waitForSafeRequest(): Promise<void> {
    const status = await this.checkLimits();
    
    if (!status.shouldAllow && status.waitTime > 0) {
      console.log(`GPS51RateLimitService: Waiting ${status.waitTime}ms before request`);
      await new Promise(resolve => setTimeout(resolve, status.waitTime));
    }
  }
}
