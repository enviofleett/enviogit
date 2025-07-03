// GPS51 Performance Monitor - Phase 4.1
// Real-time performance monitoring and metrics collection

import { gps51EventBus } from '../gps51/realtime';

export interface PerformanceMetric {
  id: string;
  name: string;
  category: 'api' | 'cache' | 'network' | 'ui' | 'database' | 'system';
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  metricName: string;
  warningLevel: number;
  criticalLevel: number;
  unit: string;
}

export interface PerformanceAlert {
  id: string;
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
}

export class GPS51PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private thresholds = new Map<string, PerformanceThreshold>();
  private alerts: PerformanceAlert[] = [];
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDefaultThresholds();
    this.setupEventListeners();
  }

  // Performance Monitoring
  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoring) return;

    this.monitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.evaluateThresholds();
    }, intervalMs);

    console.log('GPS51PerformanceMonitor: Monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoring = false;
    console.log('GPS51PerformanceMonitor: Monitoring stopped');
  }

  // Metric Collection
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      id: this.generateId(),
      ...metric,
      timestamp: new Date()
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricArray = this.metrics.get(metric.name)!;
    metricArray.push(fullMetric);

    // Keep only last 1000 metrics per type
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }

    // Emit real-time metric event
    gps51EventBus.emit('gps51.performance.metric', fullMetric, {
      source: 'performance_monitor',
      priority: 'normal'
    });
  }

  // API Performance Tracking
  async trackApiCall<T> (
    operation: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    let success = false;
    let error: Error | null = null;

    try {
      const result = await apiCall();
      success = true;
      return result;
    } catch (err) {
      error = err as Error;
      throw err;
    } finally {
      const endTime = performance.now();
      const duration = endTime - startTime;

      this.recordMetric({
        name: `api_call_duration_${operation}`,
        category: 'api',
        value: duration,
        unit: 'ms',
        metadata: {
          operation,
          success,
          error: error?.message
        }
      });

      this.recordMetric({
        name: `api_call_success_${operation}`,
        category: 'api',
        value: success ? 1 : 0,
        unit: 'boolean'
      });
    }
  }

  // Cache Performance Tracking
  trackCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'evict',
    cacheKey: string,
    duration?: number
  ): void {
    this.recordMetric({
      name: `cache_${operation}`,
      category: 'cache',
      value: operation === 'hit' || operation === 'set' ? 1 : 0,
      unit: 'count',
      metadata: {
        cacheKey,
        duration
      }
    });
  }

  // Network Performance Tracking
  trackNetworkRequest(
    url: string,
    method: string,
    duration: number,
    responseSize: number,
    statusCode: number
  ): void {
    this.recordMetric({
      name: 'network_request_duration',
      category: 'network',
      value: duration,
      unit: 'ms',
      metadata: {
        url,
        method,
        responseSize,
        statusCode
      }
    });

    this.recordMetric({
      name: 'network_request_size',
      category: 'network',
      value: responseSize,
      unit: 'bytes',
      metadata: {
        url,
        method
      }
    });
  }

  // UI Performance Tracking
  trackUIOperation(
    operation: string,
    duration: number,
    componentName?: string
  ): void {
    this.recordMetric({
      name: `ui_${operation}_duration`,
      category: 'ui',
      value: duration,
      unit: 'ms',
      metadata: {
        componentName
      }
    });
  }

  // System Metrics Collection
  private collectSystemMetrics(): void {
    // Memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory_used',
        category: 'system',
        value: memory.usedJSHeapSize,
        unit: 'bytes'
      });

      this.recordMetric({
        name: 'memory_total',
        category: 'system',
        value: memory.totalJSHeapSize,
        unit: 'bytes'
      });
    }

    // Connection info
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.recordMetric({
          name: 'network_downlink',
          category: 'network',
          value: connection.downlink || 0,
          unit: 'mbps'
        });

        this.recordMetric({
          name: 'network_rtt',
          category: 'network',
          value: connection.rtt || 0,
          unit: 'ms'
        });
      }
    }

    // Page visibility
    this.recordMetric({
      name: 'page_visible',
      category: 'ui',
      value: document.hidden ? 0 : 1,
      unit: 'boolean'
    });
  }

  // Threshold Management
  setThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.set(threshold.metricName, threshold);
  }

  private setupDefaultThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      { metricName: 'api_call_duration_vehicles', warningLevel: 2000, criticalLevel: 5000, unit: 'ms' },
      { metricName: 'api_call_duration_positions', warningLevel: 1000, criticalLevel: 3000, unit: 'ms' },
      { metricName: 'memory_used', warningLevel: 100 * 1024 * 1024, criticalLevel: 200 * 1024 * 1024, unit: 'bytes' },
      { metricName: 'network_request_duration', warningLevel: 3000, criticalLevel: 10000, unit: 'ms' },
      { metricName: 'ui_render_duration', warningLevel: 16, criticalLevel: 33, unit: 'ms' }
    ];

    defaultThresholds.forEach(threshold => {
      this.setThreshold(threshold);
    });
  }

  private evaluateThresholds(): void {
    this.thresholds.forEach((threshold, metricName) => {
      const metricHistory = this.metrics.get(metricName);
      if (!metricHistory || metricHistory.length === 0) return;

      const latestMetric = metricHistory[metricHistory.length - 1];
      const value = latestMetric.value;

      if (value >= threshold.criticalLevel) {
        this.createAlert(metricName, value, threshold.criticalLevel, 'critical');
      } else if (value >= threshold.warningLevel) {
        this.createAlert(metricName, value, threshold.warningLevel, 'warning');
      }
    });
  }

  private createAlert(
    metricName: string,
    currentValue: number,
    thresholdValue: number,
    severity: 'warning' | 'critical'
  ): void {
    const alert: PerformanceAlert = {
      id: this.generateId(),
      metricName,
      currentValue,
      thresholdValue,
      severity,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);

    // Emit alert event
    gps51EventBus.emit('gps51.performance.alert', alert, {
      source: 'performance_monitor',
      priority: severity === 'critical' ? 'high' : 'normal'
    });

    console.warn('GPS51PerformanceMonitor: Performance alert:', alert);
  }

  // Event Listeners
  private setupEventListeners(): void {
    // Listen for GPS51 events to track performance
    gps51EventBus.on('gps51.auth.success', () => {
      this.recordMetric({
        name: 'auth_success',
        category: 'api',
        value: 1,
        unit: 'count'
      });
    });

    gps51EventBus.on('gps51.sync.completed', (event) => {
      this.recordMetric({
        name: 'sync_duration',
        category: 'api',
        value: event.data?.duration || 0,
        unit: 'ms'
      });
    });

    gps51EventBus.on('gps51.error', (event) => {
      this.recordMetric({
        name: 'api_error',
        category: 'api',
        value: 1,
        unit: 'count',
        metadata: {
          error: event.data?.message
        }
      });
    });
  }

  // Analytics and Reporting
  getMetricSummary(metricName: string, timeWindow: number = 300000): any {
    const metrics = this.metrics.get(metricName) || [];
    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = metrics.filter(m => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map(m => m.value);
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      latest: values[values.length - 1],
      trend: this.calculateTrend(values)
    };
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, values.length);
    const older = values.slice(0, -5).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 5);
    
    const threshold = older * 0.1; // 10% threshold
    if (recent > older + threshold) return 'up';
    if (recent < older - threshold) return 'down';
    return 'stable';
  }

  getPerformanceReport(): any {
    const report = {
      timestamp: new Date(),
      monitoring: this.monitoring,
      metricsCount: this.metrics.size,
      activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
      systemHealth: 'good',
      metrics: {} as any
    };

    // Add summaries for key metrics
    ['api_call_duration_vehicles', 'memory_used', 'network_request_duration'].forEach(metricName => {
      const summary = this.getMetricSummary(metricName);
      if (summary) {
        report.metrics[metricName] = summary;
      }
    });

    // Determine overall system health
    const criticalAlerts = this.alerts.filter(a => !a.acknowledged && a.severity === 'critical');
    const warningAlerts = this.alerts.filter(a => !a.acknowledged && a.severity === 'warning');

    if (criticalAlerts.length > 0) {
      report.systemHealth = 'critical';
    } else if (warningAlerts.length > 2) {
      report.systemHealth = 'warning';
    } else if (warningAlerts.length > 0) {
      report.systemHealth = 'degraded';
    }

    return report;
  }

  // Public API
  getMetrics(category?: string): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach(metricArray => {
      allMetrics.push(...metricArray);
    });

    if (category) {
      return allMetrics.filter(m => m.category === category);
    }

    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlerts(acknowledged: boolean = false): PerformanceAlert[] {
    return this.alerts.filter(a => a.acknowledged === acknowledged);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    this.stopMonitoring();
    this.metrics.clear();
    this.alerts = [];
    console.log('GPS51PerformanceMonitor: Destroyed');
  }
}

// Create singleton instance
export const gps51PerformanceMonitor = new GPS51PerformanceMonitor();
