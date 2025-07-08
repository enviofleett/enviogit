/**
 * GPS51 Health Monitor
 * Monitors GPS51 service health and provides diagnostic information
 */

import { GPS51AuthenticationService } from './GPS51AuthenticationService';
import { GPS51ProxyClient } from './GPS51ProxyClient';

export interface HealthCheckResult {
  service: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

export interface GPS51SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  lastUpdate: number;
}

export class GPS51HealthMonitor {
  private static instance: GPS51HealthMonitor;
  private authService: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;
  private healthCache: GPS51SystemHealth | null = null;
  private cacheExpiry = 30000; // 30 seconds

  constructor() {
    this.authService = GPS51AuthenticationService.getInstance();
    this.proxyClient = GPS51ProxyClient.getInstance();
  }

  static getInstance(): GPS51HealthMonitor {
    if (!GPS51HealthMonitor.instance) {
      GPS51HealthMonitor.instance = new GPS51HealthMonitor();
    }
    return GPS51HealthMonitor.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<GPS51SystemHealth> {
    console.log('GPS51HealthMonitor: Starting comprehensive health check...');
    
    const checks: HealthCheckResult[] = [];
    const startTime = Date.now();

    // Check Edge Function connectivity
    try {
      const proxyResult = await this.proxyClient.testConnection();
      checks.push({
        service: 'GPS51 Edge Function',
        healthy: proxyResult.success,
        responseTime: proxyResult.responseTime,
        error: proxyResult.error,
        timestamp: Date.now()
      });
    } catch (error) {
      checks.push({
        service: 'GPS51 Edge Function',
        healthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }

    // Check GPS51 API connectivity (through proxy)
    try {
      const apiUrl = 'https://api.gps51.com/openapi';
      const apiResult = await this.testGPS51APIHealth(apiUrl);
      checks.push({
        service: 'GPS51 API',
        healthy: apiResult.healthy,
        responseTime: apiResult.responseTime,
        error: apiResult.error,
        timestamp: Date.now()
      });
    } catch (error) {
      checks.push({
        service: 'GPS51 API',
        healthy: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }

    // Determine overall health
    const healthyCount = checks.filter(check => check.healthy).length;
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyCount === checks.length) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    const health: GPS51SystemHealth = {
      overall,
      checks,
      lastUpdate: Date.now()
    };

    this.healthCache = health;
    
    console.log('GPS51HealthMonitor: Health check completed:', {
      overall,
      totalChecks: checks.length,
      healthyChecks: healthyCount,
      totalTime: Date.now() - startTime
    });

    return health;
  }

  /**
   * Test GPS51 API health through proxy
   */
  private async testGPS51APIHealth(apiUrl: string): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity by making a test request
      const testResult = await this.proxyClient.testConnection(apiUrl);
      
      return {
        healthy: testResult.success,
        responseTime: Date.now() - startTime,
        error: testResult.error
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get cached health status if available and fresh
   */
  getCachedHealth(): GPS51SystemHealth | null {
    if (!this.healthCache) {
      return null;
    }

    const age = Date.now() - this.healthCache.lastUpdate;
    if (age > this.cacheExpiry) {
      return null;
    }

    return this.healthCache;
  }

  /**
   * Get current health status (cached or fresh)
   */
  async getCurrentHealth(forceFresh = false): Promise<GPS51SystemHealth> {
    if (!forceFresh) {
      const cached = this.getCachedHealth();
      if (cached) {
        return cached;
      }
    }

    return await this.performHealthCheck();
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache = null;
  }

  /**
   * Get health summary for display
   */
  getHealthSummary(health: GPS51SystemHealth): {
    status: string;
    message: string;
    color: 'green' | 'yellow' | 'red';
  } {
    switch (health.overall) {
      case 'healthy':
        return {
          status: 'All Systems Operational',
          message: 'GPS51 services are running normally',
          color: 'green'
        };
      case 'degraded':
        return {
          status: 'Partial Service Disruption',
          message: 'Some GPS51 services may be experiencing issues',
          color: 'yellow'
        };
      case 'unhealthy':
        return {
          status: 'Service Unavailable',
          message: 'GPS51 services are currently unavailable',
          color: 'red'
        };
      default:
        return {
          status: 'Unknown',
          message: 'Unable to determine service status',
          color: 'red'
        };
    }
  }
}

export const gps51HealthMonitor = GPS51HealthMonitor.getInstance();