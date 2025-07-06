import { supabase } from '@/integrations/supabase/client';

interface RequestMetrics {
  timestamp: number;
  success: boolean;
  responseTime: number;
  action: string;
}

export class GPS51IPBanPrevention {
  private static instance: GPS51IPBanPrevention;
  private requestHistory: RequestMetrics[] = [];
  private maxHistorySize = 100;
  private isThrottling = false;
  private lastRequestTime = 0;
  private minimumDelay = 2000; // 2 seconds between requests during throttling
  
  static getInstance(): GPS51IPBanPrevention {
    if (!GPS51IPBanPrevention.instance) {
      GPS51IPBanPrevention.instance = new GPS51IPBanPrevention();
    }
    return GPS51IPBanPrevention.instance;
  }

  // Record a request for analysis
  recordRequest(action: string, success: boolean, responseTime: number): void {
    const metrics: RequestMetrics = {
      timestamp: Date.now(),
      success,
      responseTime,
      action
    };

    this.requestHistory.push(metrics);
    
    // Keep only recent history
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize);
    }

    // Analyze for potential IP ban risk
    this.analyzeRisk();
  }

  // Analyze current risk level
  private analyzeRisk(): void {
    const now = Date.now();
    const last15Minutes = now - (15 * 60 * 1000);
    const last5Minutes = now - (5 * 60 * 1000);
    
    const recent15MinRequests = this.requestHistory.filter(r => r.timestamp > last15Minutes);
    const recent5MinRequests = this.requestHistory.filter(r => r.timestamp > last5Minutes);
    
    const failures15Min = recent15MinRequests.filter(r => !r.success).length;
    const failures5Min = recent5MinRequests.filter(r => !r.success).length;
    
    // High risk: More than 10 failures in 15 minutes or 5 failures in 5 minutes
    const highRisk = failures15Min > 10 || failures5Min > 5;
    
    // Medium risk: More than 5 failures in 15 minutes or 3 failures in 5 minutes
    const mediumRisk = failures15Min > 5 || failures5Min > 3;
    
    if (highRisk && !this.isThrottling) {
      this.enableThrottling();
    } else if (!mediumRisk && this.isThrottling) {
      this.disableThrottling();
    }
  }

  // Enable request throttling
  private enableThrottling(): void {
    this.isThrottling = true;
    this.minimumDelay = 5000; // 5 seconds during high-risk periods
    console.warn('GPS51IPBanPrevention: Throttling enabled due to high failure rate');
    
    // Log alert to database
    this.logAlert('throttling_enabled', 'Request throttling enabled due to high failure rate');
  }

  // Disable request throttling
  private disableThrottling(): void {
    this.isThrottling = false;
    this.minimumDelay = 2000; // Back to 2 seconds
    console.log('GPS51IPBanPrevention: Throttling disabled - failure rate normalized');
    
    // Log alert to database
    this.logAlert('throttling_disabled', 'Request throttling disabled - failure rate normalized');
  }

  // Check if a request should wait before proceeding
  async shouldThrottleRequest(): Promise<{ shouldWait: boolean; waitTime: number }> {
    if (!this.isThrottling) {
      return { shouldWait: false, waitTime: 0 };
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minimumDelay) {
      const waitTime = this.minimumDelay - timeSinceLastRequest;
      return { shouldWait: true, waitTime };
    }

    this.lastRequestTime = now;
    return { shouldWait: false, waitTime: 0 };
  }

  // Get current risk level
  getCurrentRiskLevel(): 'low' | 'medium' | 'high' {
    const now = Date.now();
    const last15Minutes = now - (15 * 60 * 1000);
    const last5Minutes = now - (5 * 60 * 1000);
    
    const recent15MinRequests = this.requestHistory.filter(r => r.timestamp > last15Minutes);
    const recent5MinRequests = this.requestHistory.filter(r => r.timestamp > last5Minutes);
    
    const failures15Min = recent15MinRequests.filter(r => !r.success).length;
    const failures5Min = recent5MinRequests.filter(r => !r.success).length;
    
    if (failures15Min > 10 || failures5Min > 5) {
      return 'high';
    } else if (failures15Min > 5 || failures5Min > 3) {
      return 'medium';
    }
    
    return 'low';
  }

  // Get detailed metrics
  getMetrics(): {
    isThrottling: boolean;
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    riskLevel: string;
    recentFailures: number;
  } {
    const now = Date.now();
    const last15Minutes = now - (15 * 60 * 1000);
    const recentRequests = this.requestHistory.filter(r => r.timestamp > last15Minutes);
    
    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(r => r.success);
    const successRate = totalRequests > 0 ? (successfulRequests.length / totalRequests) * 100 : 0;
    const averageResponseTime = successfulRequests.length > 0 
      ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length
      : 0;
    const recentFailures = recentRequests.filter(r => !r.success).length;
    
    return {
      isThrottling: this.isThrottling,
      totalRequests,
      successRate,
      averageResponseTime,
      riskLevel: this.getCurrentRiskLevel(),
      recentFailures
    };
  }

  // Log alert to database
  private async logAlert(type: string, message: string): Promise<void> {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: 'GPS51-IPBanPrevention',
        method: 'ALERT',
        request_payload: { alertType: type, metrics: this.getMetrics() },
        response_status: 200,
        response_body: { message },
        duration_ms: 0,
        error_message: null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log IP ban prevention alert:', error);
    }
  }

  // Reset all metrics (for testing or manual reset)
  reset(): void {
    this.requestHistory = [];
    this.isThrottling = false;
    this.lastRequestTime = 0;
    this.minimumDelay = 2000;
    console.log('GPS51IPBanPrevention: All metrics reset');
  }
}

// Export singleton instance
export const gps51IPBanPrevention = GPS51IPBanPrevention.getInstance();
