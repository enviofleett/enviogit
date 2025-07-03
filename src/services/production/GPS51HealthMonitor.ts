// GPS51 Health Monitor - Phase 4.5
// System health monitoring and diagnostics

import { gps51ConfigManager } from './GPS51ConfigManager';
import { gps51PerformanceMonitor } from '../performance/GPS51PerformanceMonitor';
import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  responseTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  score: number; // 0-100
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
    total: number;
  };
  lastUpdated: Date;
}

export interface HealthAlert {
  id: string;
  type: 'service_down' | 'performance_degraded' | 'resource_exhausted' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedServices: string[];
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export class GPS51HealthMonitor {
  private static instance: GPS51HealthMonitor;
  private healthChecks = new Map<string, HealthCheckResult>();
  private alerts: HealthAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  static getInstance(): GPS51HealthMonitor {
    if (!GPS51HealthMonitor.instance) {
      GPS51HealthMonitor.instance = new GPS51HealthMonitor();
    }
    return GPS51HealthMonitor.instance;
  }

  constructor() {
    this.setupHealthChecks();
  }

  private setupHealthChecks(): void {
    // Register built-in health checks
    this.registerHealthCheck('gps51_api', this.checkGPS51API.bind(this));
    this.registerHealthCheck('supabase_connection', this.checkSupabaseConnection.bind(this));
    this.registerHealthCheck('browser_storage', this.checkBrowserStorage.bind(this));
    this.registerHealthCheck('memory_usage', this.checkMemoryUsage.bind(this));
    this.registerHealthCheck('network_connectivity', this.checkNetworkConnectivity.bind(this));
    this.registerHealthCheck('performance_metrics', this.checkPerformanceMetrics.bind(this));
  }

  // Health Check Registration
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    // Store the function for later execution
    this.healthChecks.set(name, {
      id: name,
      name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      status: 'unknown',
      message: 'Not yet checked',
      responseTime: 0,
      timestamp: new Date()
    });
  }

  // Built-in Health Checks
  private async checkGPS51API(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'gps51_api';

    try {
      // Try to reach GPS51 API health endpoint
      const config = gps51ConfigManager.getCurrentConfig();
      const apiUrl = config?.environment.apiUrl || 'https://api.gps51.com/openapi';
      
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      const responseTime = performance.now() - startTime;

      if (response.ok) {
        return {
          id: checkId,
          name: 'GPS51 API',
          status: 'healthy',
          message: 'GPS51 API is responding normally',
          responseTime,
          timestamp: new Date(),
          metadata: {
            statusCode: response.status,
            apiUrl: apiUrl
          }
        };
      } else {
        return {
          id: checkId,
          name: 'GPS51 API',
          status: 'warning',
          message: `GPS51 API returned status ${response.status}`,
          responseTime,
          timestamp: new Date(),
          metadata: {
            statusCode: response.status,
            statusText: response.statusText
          }
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'GPS51 API',
        status: 'critical',
        message: `GPS51 API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkSupabaseConnection(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'supabase_connection';

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      const responseTime = performance.now() - startTime;

      if (error) {
        return {
          id: checkId,
          name: 'Supabase Connection',
          status: 'critical',
          message: `Supabase error: ${error.message}`,
          responseTime,
          timestamp: new Date(),
          metadata: { error: error.message }
        };
      }

      return {
        id: checkId,
        name: 'Supabase Connection',
        status: 'healthy',
        message: 'Supabase connection is working',
        responseTime,
        timestamp: new Date()
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'Supabase Connection',
        status: 'critical',
        message: `Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkBrowserStorage(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'browser_storage';

    try {
      // Test localStorage
      const testKey = 'health_check_test';
      const testValue = Date.now().toString();
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      const responseTime = performance.now() - startTime;

      if (retrieved === testValue) {
        return {
          id: checkId,
          name: 'Browser Storage',
          status: 'healthy',
          message: 'Browser storage is working correctly',
          responseTime,
          timestamp: new Date()
        };
      } else {
        return {
          id: checkId,
          name: 'Browser Storage',
          status: 'warning',
          message: 'Browser storage test failed',
          responseTime,
          timestamp: new Date()
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'Browser Storage',
        status: 'critical',
        message: `Browser storage error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'memory_usage';

    try {
      const responseTime = performance.now() - startTime;

      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        
        const usagePercent = (usedMB / limitMB) * 100;

        let status: HealthCheckResult['status'] = 'healthy';
        let message = `Memory usage: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`;

        if (usagePercent > 80) {
          status = 'critical';
          message = `High memory usage: ${usagePercent.toFixed(1)}%`;
        } else if (usagePercent > 60) {
          status = 'warning';
          message = `Elevated memory usage: ${usagePercent.toFixed(1)}%`;
        }

        return {
          id: checkId,
          name: 'Memory Usage',
          status,
          message,
          responseTime,
          timestamp: new Date(),
          metadata: {
            usedMB,
            totalMB,
            limitMB,
            usagePercent: usagePercent.toFixed(1)
          }
        };
      } else {
        return {
          id: checkId,
          name: 'Memory Usage',
          status: 'warning',
          message: 'Memory information not available in this browser',
          responseTime,
          timestamp: new Date()
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'Memory Usage',
        status: 'warning',
        message: `Could not check memory usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'network_connectivity';

    try {
      const isOnline = navigator.onLine;
      const responseTime = performance.now() - startTime;

      if (isOnline) {
        // Additional check with a simple request
        try {
          await fetch('/favicon.ico', { 
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(3000)
          });

          return {
            id: checkId,
            name: 'Network Connectivity',
            status: 'healthy',
            message: 'Network connection is active',
            responseTime,
            timestamp: new Date()
          };
        } catch {
          return {
            id: checkId,
            name: 'Network Connectivity',
            status: 'warning',
            message: 'Network may be unstable',
            responseTime,
            timestamp: new Date()
          };
        }
      } else {
        return {
          id: checkId,
          name: 'Network Connectivity',
          status: 'critical',
          message: 'No network connection detected',
          responseTime,
          timestamp: new Date()
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'Network Connectivity',
        status: 'warning',
        message: `Network check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  private async checkPerformanceMetrics(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const checkId = 'performance_metrics';

    try {
      const report = gps51PerformanceMonitor.getPerformanceReport();
      const responseTime = performance.now() - startTime;

      let status: HealthCheckResult['status'] = 'healthy';
      let message = `System health: ${report.systemHealth}`;

      if (report.systemHealth === 'critical') {
        status = 'critical';
        message = `Critical performance issues detected (${report.activeAlerts} active alerts)`;
      } else if (report.systemHealth === 'warning' || report.systemHealth === 'degraded') {
        status = 'warning';
        message = `Performance issues detected (${report.activeAlerts} active alerts)`;
      }

      return {
        id: checkId,
        name: 'Performance Metrics',
        status,
        message,
        responseTime,
        timestamp: new Date(),
        metadata: {
          systemHealth: report.systemHealth,
          activeAlerts: report.activeAlerts,
          monitoringActive: report.monitoring
        }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        id: checkId,
        name: 'Performance Metrics',
        status: 'warning',
        message: `Performance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime,
        timestamp: new Date()
      };
    }
  }

  // Monitoring Control
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.runAllHealthChecks();
    }, intervalMs);

    // Run initial health check
    this.runAllHealthChecks();

    console.log('GPS51HealthMonitor: Monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('GPS51HealthMonitor: Monitoring stopped');
  }

  // Health Check Execution
  private async runAllHealthChecks(): Promise<void> {
    const checkPromises: Promise<void>[] = [];

    for (const [name] of this.healthChecks) {
      checkPromises.push(this.runHealthCheck(name));
    }

    await Promise.allSettled(checkPromises);
    this.evaluateOverallHealth();
  }

  private async runHealthCheck(name: string): Promise<void> {
    try {
      let result: HealthCheckResult;

      switch (name) {
        case 'gps51_api':
          result = await this.checkGPS51API();
          break;
        case 'supabase_connection':
          result = await this.checkSupabaseConnection();
          break;
        case 'browser_storage':
          result = await this.checkBrowserStorage();
          break;
        case 'memory_usage':
          result = await this.checkMemoryUsage();
          break;
        case 'network_connectivity':
          result = await this.checkNetworkConnectivity();
          break;
        case 'performance_metrics':
          result = await this.checkPerformanceMetrics();
          break;
        default:
          result = {
            id: name,
            name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            status: 'unknown',
            message: 'Health check not implemented',
            responseTime: 0,
            timestamp: new Date()
          };
      }

      this.healthChecks.set(name, result);
      this.checkForAlerts(result);
    } catch (error) {
      console.error(`Health check failed for ${name}:`, error);
      
      this.healthChecks.set(name, {
        id: name,
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: 0,
        timestamp: new Date()
      });
    }
  }

  private evaluateOverallHealth(): void {
    const checks = Array.from(this.healthChecks.values());
    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const criticalCount = checks.filter(c => c.status === 'critical').length;

    // Calculate health score
    const totalChecks = checks.length;
    const score = totalChecks > 0 
      ? Math.round(((healthyCount * 100) + (warningCount * 50)) / totalChecks)
      : 0;

    // Determine overall status
    let overall: SystemHealth['overall'] = 'healthy';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (warningCount > 0) {
      overall = 'degraded';
    }

    console.log(`GPS51HealthMonitor: Overall health: ${overall} (${score}/100)`);
  }

  private checkForAlerts(result: HealthCheckResult): void {
    if (result.status === 'critical' || result.status === 'warning') {
      const existingAlert = this.alerts.find(a => 
        a.affectedServices.includes(result.id) && !a.resolved
      );

      if (!existingAlert) {
        const alert: HealthAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: result.status === 'critical' ? 'service_down' : 'performance_degraded',
          severity: result.status === 'critical' ? 'critical' : 'medium',
          title: `${result.name} Health Issue`,
          description: result.message,
          affectedServices: [result.id],
          timestamp: new Date(),
          resolved: false
        };

        this.alerts.push(alert);
        console.warn('GPS51HealthMonitor: New health alert created:', alert);
      }
    } else if (result.status === 'healthy') {
      // Resolve any existing alerts for this service
      this.alerts.forEach(alert => {
        if (alert.affectedServices.includes(result.id) && !alert.resolved) {
          alert.resolved = true;
          alert.resolvedAt = new Date();
          console.log('GPS51HealthMonitor: Health alert resolved:', alert);
        }
      });
    }
  }

  // Public API
  getCurrentHealth(): SystemHealth {
    const checks = Array.from(this.healthChecks.values());
    const healthyCount = checks.filter(c => c.status === 'healthy').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;
    const criticalCount = checks.filter(c => c.status === 'critical').length;
    const totalChecks = checks.length;

    const score = totalChecks > 0 
      ? Math.round(((healthyCount * 100) + (warningCount * 50)) / totalChecks)
      : 0;

    let overall: SystemHealth['overall'] = 'healthy';
    if (criticalCount > 0) {
      overall = 'critical';
    } else if (warningCount > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      score,
      checks,
      summary: {
        healthy: healthyCount,
        warning: warningCount,
        critical: criticalCount,
        total: totalChecks
      },
      lastUpdated: new Date()
    };
  }

  getHealthCheck(name: string): HealthCheckResult | null {
    return this.healthChecks.get(name) || null;
  }

  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(): HealthAlert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  // Manual health check trigger
  async runManualHealthCheck(name: string): Promise<HealthCheckResult | null> {
    if (!this.healthChecks.has(name)) {
      return null;
    }

    await this.runHealthCheck(name);
    return this.healthChecks.get(name) || null;
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring();
    this.healthChecks.clear();
    this.alerts = [];
    console.log('GPS51HealthMonitor: Destroyed');
  }
}

// Create singleton instance
export const gps51HealthMonitor = GPS51HealthMonitor.getInstance();