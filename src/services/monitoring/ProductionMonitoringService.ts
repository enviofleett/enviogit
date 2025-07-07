import { supabase } from '@/integrations/supabase/client';
import { getEnvironmentConfig, getCurrentEnvironment } from '@/config/environment';
import { gps51StartupService } from '@/services/gps51/GPS51StartupService';
import { GPS51RateLimitService } from '@/services/gps51/GPS51RateLimitService';

export interface SystemMetrics {
  timestamp: number;
  environment: string;
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  availability: {
    uptime: number;
    healthScore: number;
    servicesUp: number;
    servicesTotal: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    activeConnections: number;
  };
  errors: {
    total: number;
    critical: number;
    warnings: number;
    byService: Record<string, number>;
  };
  business: {
    activeUsers: number;
    vehiclesOnline: number;
    commandsExecuted: number;
    dataPointsProcessed: number;
  };
  gps51Optimization: {
    successRate: number;
    averageResponseTime: number;
    cacheHitRate: number;
    circuitBreakerStatus: string;
    rateLimitActiveBlocks: number;
    totalRequests: number;
    recentErrors: number;
  };
}

export interface Alert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  service: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  escalated: boolean;
  escalatedAt?: number;
  metadata: Record<string, any>;
}

export class ProductionMonitoringService {
  private static instance: ProductionMonitoringService;
  private metricsHistory: SystemMetrics[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private alertCallbacks: Set<(alert: Alert) => void> = new Set();

  static getInstance(): ProductionMonitoringService {
    if (!ProductionMonitoringService.instance) {
      ProductionMonitoringService.instance = new ProductionMonitoringService();
    }
    return ProductionMonitoringService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const config = getEnvironmentConfig();
    
    // PHASE 3 EMERGENCY SPIKE ELIMINATION: Completely disable monitoring
    console.log('ProductionMonitoringService: PHASE 3 EMERGENCY MODE - All monitoring disabled to prevent API spikes');
    this.isInitialized = true;
    return;

    // Original monitoring code disabled for emergency spike elimination
    /*
    if (!config.monitoring.enabled) {
      console.log('ProductionMonitoringService: Monitoring disabled in current environment');
      return;
    }

    console.log('ProductionMonitoringService: Initializing production monitoring...');

    // Start metrics collection
    await this.startMetricsCollection();
    
    // Start health checks
    this.startHealthChecks();
    
    // Initialize alert system
    this.initializeAlertSystem();

    this.isInitialized = true;
    console.log('ProductionMonitoringService: Production monitoring initialized');
    */
  }

  private async startMetricsCollection(): Promise<void> {
    const config = getEnvironmentConfig();
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // EMERGENCY SPIKE ELIMINATION: Disable metrics collection interval
    // this.monitoringInterval = setInterval(async () => {
    //   try {
    //     const metrics = await this.collectSystemMetrics();
    //     this.processMetrics(metrics);
    //     await this.storeMetrics(metrics);
    //   } catch (error) {
    //     console.error('ProductionMonitoringService: Failed to collect metrics:', error);
    //   }
    // }, config.monitoring.metricsCollectionInterval);
    console.log('ProductionMonitoringService: Metrics collection disabled for emergency spike elimination');

    // Collect initial metrics
    const metrics = await this.collectSystemMetrics();
    this.processMetrics(metrics);
    await this.storeMetrics(metrics);
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const startTime = Date.now();
    
    // Collect performance metrics
    const performance = await this.collectPerformanceMetrics();
    
    // Collect availability metrics
    const availability = await this.collectAvailabilityMetrics();
    
    // Collect resource metrics
    const resources = await this.collectResourceMetrics();
    
    // Collect error metrics
    const errors = await this.collectErrorMetrics();
    
    // Collect business metrics
    const business = await this.collectBusinessMetrics();
    
    // Collect GPS51 optimization metrics
    const gps51Optimization = await this.collectGPS51OptimizationMetrics();

    return {
      timestamp: Date.now(),
      environment: getCurrentEnvironment(),
      performance,
      availability,
      resources,
      errors,
      business,
      gps51Optimization
    };
  }

  private async collectPerformanceMetrics() {
    try {
      // Get recent API call logs for performance metrics
      const { data: apiLogs } = await supabase
        .from('api_calls_monitor')
        .select('duration_ms, response_status, created_at')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('created_at', { ascending: false });

      if (!apiLogs || apiLogs.length === 0) {
        return {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestsPerSecond: 0,
          errorRate: 0
        };
      }

      const responseTimes = apiLogs.map(log => log.duration_ms || 0);
      const errors = apiLogs.filter(log => log.response_status >= 400);
      
      // Calculate percentiles
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p99Index = Math.floor(sortedTimes.length * 0.99);

      return {
        averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        p95ResponseTime: sortedTimes[p95Index] || 0,
        p99ResponseTime: sortedTimes[p99Index] || 0,
        requestsPerSecond: apiLogs.length / 300, // 5 minutes = 300 seconds
        errorRate: (errors.length / apiLogs.length) * 100
      };
    } catch (error) {
      console.error('Failed to collect performance metrics:', error);
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        errorRate: 0
      };
    }
  }

  private async collectAvailabilityMetrics() {
    try {
      // Test critical services
      const services = ['authentication', 'database', 'gps51', 'realtime'];
      const serviceTests = await Promise.allSettled(services.map(service => this.testService(service)));
      
      const servicesUp = serviceTests.filter(result => result.status === 'fulfilled').length;
      const healthScore = (servicesUp / services.length) * 100;
      
      return {
        uptime: healthScore > 80 ? 99.9 : healthScore > 50 ? 95.0 : 80.0,
        healthScore,
        servicesUp,
        servicesTotal: services.length
      };
    } catch (error) {
      return {
        uptime: 0,
        healthScore: 0,
        servicesUp: 0,
        servicesTotal: 4
      };
    }
  }

  private async testService(service: string): Promise<boolean> {
    switch (service) {
      case 'database':
        const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
        return !dbError;
      
      case 'authentication':
        const { data: { session } } = await supabase.auth.getSession();
        return true; // If we can check session, auth is working
      
      case 'gps51':
        // Test GPS51 optimization system
        try {
          const rateLimitService = GPS51RateLimitService.getInstance();
          const status = await rateLimitService.getStatus();
          return status.rateLimitState.circuitBreakerOpen === false;
        } catch {
          return false;
        }
      
      case 'realtime':
        // Test realtime connectivity
        return true; // Simplified test
      
      default:
        return false;
    }
  }

  private async collectResourceMetrics() {
    // Browser-based resource metrics
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const memory = (performance as any).memory;
    
    return {
      memoryUsage: memory ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 : 0,
      cpuUsage: 0, // Not available in browser
      networkLatency: navigation ? navigation.responseEnd - navigation.requestStart : 0,
      activeConnections: 1 // Current session
    };
  }

  private async collectErrorMetrics() {
    try {
      const { data: errorLogs } = await supabase
        .from('api_calls_monitor')
        .select('response_status, endpoint, error_message')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .gte('response_status', 400);

      const errors = errorLogs || [];
      const critical = errors.filter(e => e.response_status >= 500).length;
      const warnings = errors.filter(e => e.response_status >= 400 && e.response_status < 500).length;
      
      const byService: Record<string, number> = {};
      errors.forEach(error => {
        const service = error.endpoint?.split('/')[1] || 'unknown';
        byService[service] = (byService[service] || 0) + 1;
      });

      return {
        total: errors.length,
        critical,
        warnings,
        byService
      };
    } catch (error) {
      return {
        total: 0,
        critical: 0,
        warnings: 0,
        byService: {}
      };
    }
  }

  private async collectBusinessMetrics() {
    try {
      // Get recent activity for business metrics
      const { data: recentActivity } = await supabase
        .from('activity_logs')
        .select('activity_type, created_at, user_id')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      const activity = recentActivity || [];
      const uniqueUsers = new Set(activity.map(a => a.user_id)).size;
      const vehicleCommands = activity.filter(a => a.activity_type === 'vehicle_control').length;
      
      return {
        activeUsers: uniqueUsers,
        vehiclesOnline: 0, // Would need vehicle status data
        commandsExecuted: vehicleCommands,
        dataPointsProcessed: activity.length
      };
    } catch (error) {
      return {
        activeUsers: 0,
        vehiclesOnline: 0,
        commandsExecuted: 0,
        dataPointsProcessed: 0
      };
    }
  }

  private async collectGPS51OptimizationMetrics() {
    try {
      const rateLimitService = GPS51RateLimitService.getInstance();
      const status = await rateLimitService.getStatus();
      
      // Get recent GPS51 API calls for optimization analysis
      const { data: gps51Logs } = await supabase
        .from('api_calls_monitor')
        .select('duration_ms, response_status, endpoint, error_message')
        .like('endpoint', 'GPS51%')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const logs = gps51Logs || [];
      const successfulRequests = logs.filter(log => log.response_status < 400);
      const cacheLogs = logs.filter(log => log.endpoint?.includes('Cache'));
      
      return {
        successRate: logs.length > 0 ? (successfulRequests.length / logs.length) * 100 : 100,
        averageResponseTime: status.metrics.averageResponseTime,
        cacheHitRate: logs.length > 0 ? (cacheLogs.length / logs.length) * 100 : 0,
        circuitBreakerStatus: status.rateLimitState.circuitBreakerOpen ? 'Open' : 'Closed',
        rateLimitActiveBlocks: status.rateLimitState.rateLimitCooldownUntil > Date.now() ? 1 : 0,
        totalRequests: status.metrics.totalRequests,
        recentErrors: status.metrics.failedRequests
      };
    } catch (error) {
      console.error('Failed to collect GPS51 optimization metrics:', error);
      return {
        successRate: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        circuitBreakerStatus: 'Unknown',
        rateLimitActiveBlocks: 0,
        totalRequests: 0,
        recentErrors: 0
      };
    }
  }

  private processMetrics(metrics: SystemMetrics): void {
    // Add to history
    this.metricsHistory.push(metrics);
    
    // Keep only last 100 metric points
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    // Check for alerts
    this.checkAlertConditions(metrics);
  }

  private checkAlertConditions(metrics: SystemMetrics): void {
    const config = getEnvironmentConfig();
    const thresholds = config.alerts.thresholds;

    // Check error rate
    if (metrics.performance.errorRate > thresholds.errorRate) {
      this.createAlert({
        level: metrics.performance.errorRate > thresholds.errorRate * 2 ? 'critical' : 'warning',
        title: 'High Error Rate',
        message: `Error rate is ${metrics.performance.errorRate.toFixed(2)}%, exceeding threshold of ${thresholds.errorRate}%`,
        service: 'api',
        metric: 'error_rate',
        value: metrics.performance.errorRate,
        threshold: thresholds.errorRate,
        metadata: { performance: metrics.performance }
      });
    }

    // Check response time
    if (metrics.performance.averageResponseTime > thresholds.responseTime) {
      this.createAlert({
        level: metrics.performance.averageResponseTime > thresholds.responseTime * 2 ? 'critical' : 'warning',
        title: 'Slow Response Time',
        message: `Average response time is ${metrics.performance.averageResponseTime.toFixed(0)}ms, exceeding threshold of ${thresholds.responseTime}ms`,
        service: 'api',
        metric: 'response_time',
        value: metrics.performance.averageResponseTime,
        threshold: thresholds.responseTime,
        metadata: { performance: metrics.performance }
      });
    }

    // Check availability
    if (metrics.availability.healthScore < thresholds.availability) {
      this.createAlert({
        level: metrics.availability.healthScore < thresholds.availability * 0.8 ? 'critical' : 'warning',
        title: 'Low System Availability',
        message: `System health score is ${metrics.availability.healthScore.toFixed(1)}%, below threshold of ${thresholds.availability}%`,
        service: 'system',
        metric: 'availability',
        value: metrics.availability.healthScore,
        threshold: thresholds.availability,
        metadata: { availability: metrics.availability }
      });
    }

    // Check GPS51 optimization health
    if (metrics.gps51Optimization.successRate < 95) {
      this.createAlert({
        level: metrics.gps51Optimization.successRate < 80 ? 'critical' : 'warning',
        title: 'GPS51 Optimization Issues',
        message: `GPS51 success rate is ${metrics.gps51Optimization.successRate.toFixed(1)}%, below optimal threshold`,
        service: 'gps51',
        metric: 'success_rate',
        value: metrics.gps51Optimization.successRate,
        threshold: 95,
        metadata: { gps51Optimization: metrics.gps51Optimization }
      });
    }

    // Check GPS51 circuit breaker
    if (metrics.gps51Optimization.circuitBreakerStatus === 'Open') {
      this.createAlert({
        level: 'critical',
        title: 'GPS51 Circuit Breaker Open',
        message: 'GPS51 circuit breaker is open due to consecutive failures. System is in protection mode.',
        service: 'gps51',
        metric: 'circuit_breaker',
        value: 1,
        threshold: 0,
        metadata: { gps51Optimization: metrics.gps51Optimization }
      });
    }

    // Check GPS51 rate limiting
    if (metrics.gps51Optimization.rateLimitActiveBlocks > 0) {
      this.createAlert({
        level: 'warning',
        title: 'GPS51 Rate Limiting Active',
        message: 'GPS51 requests are being rate limited. This may indicate API load issues.',
        service: 'gps51',
        metric: 'rate_limit',
        value: metrics.gps51Optimization.rateLimitActiveBlocks,
        threshold: 0,
        metadata: { gps51Optimization: metrics.gps51Optimization }
      });
    }
  }

  private createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved' | 'escalated'>): void {
    const alert: Alert = {
      ...alertData,
      id: `${alertData.service}_${alertData.metric}_${Date.now()}`,
      timestamp: Date.now(),
      resolved: false,
      escalated: false
    };

    this.activeAlerts.set(alert.id, alert);
    
    // Notify alert callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });

    console.warn('ProductionMonitoringService: Alert created:', alert);
  }

  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      // EMERGENCY: Disable metrics logging to prevent feedback loops
      // Only log critical errors, not routine metrics
      console.log('ProductionMonitoringService: Metrics captured successfully');
    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  private startHealthChecks(): void {
    const config = getEnvironmentConfig();
    
    setInterval(async () => {
      try {
        const healthStatus = await this.performHealthCheck();
        
        if (!healthStatus.healthy) {
          this.createAlert({
            level: 'critical',
            title: 'System Health Check Failed',
            message: healthStatus.message,
            service: 'system',
            metric: 'health_check',
            value: 0,
            threshold: 1,
            metadata: { healthStatus }
          });
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, config.monitoring.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Use timeout for edge function call to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 10000)
      );

      const healthCheckPromise = supabase.functions.invoke('mobile-production-monitor', {
        body: { 
          includeMetrics: false,
          includeRecommendations: false 
        }
      });

      const { data, error } = await Promise.race([healthCheckPromise, timeoutPromise]) as any;
      
      if (error) {
        console.warn('ProductionMonitoringService: Edge function call failed, falling back to basic health check');
        return await this.performBasicHealthCheck();
      }

      if (!data || !data.success) {
        console.warn('ProductionMonitoringService: Edge function returned error, falling back to basic health check');
        return await this.performBasicHealthCheck();
      }

      return {
        healthy: data.health?.overall === 'healthy',
        message: `System status: ${data.health?.overall || 'unknown'}`
      };
    } catch (error) {
      console.warn('ProductionMonitoringService: Health check exception, falling back to basic health check:', error);
      return await this.performBasicHealthCheck();
    }
  }

  private async performBasicHealthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Basic database connectivity test
      const { error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);

      if (dbError) {
        return {
          healthy: false,
          message: `Database connectivity failed: ${dbError.message}`
        };
      }

      // Basic GPS51 system check
      const gps51Status = gps51StartupService.isAuthenticated();
      
      return {
        healthy: true,
        message: `Basic health check passed - DB: OK, GPS51: ${gps51Status ? 'OK' : 'WARNING'}`
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Basic health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private initializeAlertSystem(): void {
    console.log('ProductionMonitoringService: Alert system initialized');
  }

  // Public API
  public getLatestMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  public getMetricsHistory(minutes: number = 60): SystemMetrics[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  public resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.activeAlerts.set(alertId, alert);
    }
  }

  public onAlert(callback: (alert: Alert) => void): () => void {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }

  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isInitialized = false;
    console.log('ProductionMonitoringService: Monitoring shutdown');
  }
}

export const productionMonitoringService = ProductionMonitoringService.getInstance();
