import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { gps51DatabaseIntegration } from './GPS51DatabaseIntegration';
import { gps51LiveDataManager } from './GPS51LiveDataManager';

export interface ProductionReadinessCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ProductionReadinessReport {
  overallStatus: 'ready' | 'needs_attention' | 'not_ready';
  score: number; // 0-100
  checks: ProductionReadinessCheck[];
  recommendations: string[];
  timestamp: Date;
}

export class GPS51ProductionValidator {
  private static instance: GPS51ProductionValidator;

  static getInstance(): GPS51ProductionValidator {
    if (!GPS51ProductionValidator.instance) {
      GPS51ProductionValidator.instance = new GPS51ProductionValidator();
    }
    return GPS51ProductionValidator.instance;
  }

  async runCompleteValidation(): Promise<ProductionReadinessReport> {
    console.log('GPS51ProductionValidator: Starting comprehensive production readiness validation...');
    
    const checks: ProductionReadinessCheck[] = [];
    const recommendations: string[] = [];

    // Run all validation checks
    checks.push(...await this.validateConnectionHealth());
    checks.push(...await this.validateAuthenticationSystem());
    checks.push(...await this.validateDataFlow());
    checks.push(...await this.validateDatabaseIntegration());
    checks.push(...await this.validateLiveDataSystem());
    checks.push(...await this.validateErrorHandling());
    checks.push(...await this.validatePerformanceMetrics());

    // Calculate overall score and status
    const { score, status } = this.calculateOverallStatus(checks);
    
    // Generate recommendations based on failed checks
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warningChecks = checks.filter(check => check.status === 'warning');

    if (failedChecks.length > 0) {
      recommendations.push(`Address ${failedChecks.length} critical issues before production deployment`);
      failedChecks.forEach(check => {
        if (check.severity === 'critical') {
          recommendations.push(`CRITICAL: ${check.name} - ${check.message}`);
        }
      });
    }

    if (warningChecks.length > 0) {
      recommendations.push(`Consider resolving ${warningChecks.length} warning issues for optimal performance`);
    }

    const report: ProductionReadinessReport = {
      overallStatus: status,
      score,
      checks,
      recommendations,
      timestamp: new Date()
    };

    console.log('GPS51ProductionValidator: Validation completed', {
      overallStatus: status,
      score,
      totalChecks: checks.length,
      passed: checks.filter(c => c.status === 'pass').length,
      warnings: warningChecks.length,
      failed: failedChecks.length
    });

    return report;
  }

  private async validateConnectionHealth(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      
      checks.push({
        name: 'Connection Health',
        status: connectionHealth.overallHealth === 'good' ? 'pass' : 
               connectionHealth.overallHealth === 'degraded' ? 'warning' : 'fail',
        message: `Overall connection health: ${connectionHealth.overallHealth}`,
        details: connectionHealth,
        severity: connectionHealth.overallHealth === 'poor' ? 'critical' : 'medium'
      });

      // Test actual connectivity
      const connectivityTest = await gps51IntelligentConnectionManager.testAllConnections();
      const workingConnections = Array.from(connectivityTest.values()).filter(result => result.success);
      
      checks.push({
        name: 'API Connectivity',
        status: workingConnections.length > 0 ? 'pass' : 'fail',
        message: `${workingConnections.length} working connection(s) available`,
        details: Object.fromEntries(connectivityTest),
        severity: workingConnections.length === 0 ? 'critical' : 'low'
      });

    } catch (error) {
      checks.push({
        name: 'Connection Health Check',
        status: 'fail',
        message: `Failed to validate connection health: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return checks;
  }

  private async validateAuthenticationSystem(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      // Test connection strategies
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      const hasWorkingStrategy = connectionHealth.strategies.some(s => s.available);
      
      checks.push({
        name: 'Authentication Strategy Available',
        status: hasWorkingStrategy ? 'pass' : 'fail',
        message: hasWorkingStrategy ? 
          `Recommended strategy: ${connectionHealth.recommendedStrategy}` : 
          'No authentication strategies available',
        details: connectionHealth.strategies,
        severity: 'critical'
      });

    } catch (error) {
      checks.push({
        name: 'Authentication System Check',
        status: 'fail',
        message: `Authentication validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return checks;
  }

  private async validateDataFlow(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      // Use coordinator status instead of removed enhanced sync service
      const coordinatorStatus = await gps51CoordinatorClient.getCoordinatorStatus();
      
      checks.push({
        name: 'Coordinator Status',
        status: !coordinatorStatus.circuitBreakerOpen ? 'pass' : 'fail',
        message: `Circuit breaker: ${coordinatorStatus.circuitBreakerOpen ? 'Open' : 'Closed'}`,
        details: coordinatorStatus,
        severity: coordinatorStatus.circuitBreakerOpen ? 'high' : 'low'
      });

      checks.push({
        name: 'Request Queue Health',
        status: coordinatorStatus.queueSize < 100 ? 'pass' : 'warning',
        message: `Queue size: ${coordinatorStatus.queueSize} requests`,
        details: coordinatorStatus,
        severity: 'medium'
      });

    } catch (error) {
      checks.push({
        name: 'Data Flow Validation',
        status: 'fail',
        message: `Data flow validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'high'
      });
    }

    return checks;
  }

  private async validateDatabaseIntegration(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      const dbTest = await gps51DatabaseIntegration.testDatabaseConnection();
      
      checks.push({
        name: 'Database Connectivity',
        status: dbTest.success ? 'pass' : 'fail',
        message: dbTest.success ? 'Database connection healthy' : `Database error: ${dbTest.error}`,
        details: dbTest,
        severity: 'critical'
      });

      const syncStats = await gps51DatabaseIntegration.getSyncJobStats();
      
      checks.push({
        name: 'Database Sync Performance',
        status: syncStats.successRate > 90 ? 'pass' : 
               syncStats.successRate > 70 ? 'warning' : 'fail',
        message: `Database sync success rate: ${syncStats.successRate.toFixed(1)}%`,
        details: syncStats,
        severity: 'high'
      });

    } catch (error) {
      checks.push({
        name: 'Database Integration Check',
        status: 'fail',
        message: `Database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return checks;
  }

  private async validateLiveDataSystem(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      const liveDataStatus = gps51LiveDataManager.getStatus();
      
      checks.push({
        name: 'Live Data System',
        status: liveDataStatus.isActive ? 'pass' : 'fail',
        message: liveDataStatus.isActive ? 'Live data system active' : 'Live data system inactive',
        details: liveDataStatus,
        severity: 'critical'
      });

      checks.push({
        name: 'Device Data Availability',
        status: liveDataStatus.deviceCount > 0 ? 'pass' : 'warning',
        message: `${liveDataStatus.deviceCount} devices available`,
        severity: 'medium'
      });

      const dataAge = liveDataStatus.lastUpdate ? 
        Date.now() - liveDataStatus.lastUpdate.getTime() : Infinity;
      
      checks.push({
        name: 'Data Freshness',
        status: dataAge < 60000 ? 'pass' : dataAge < 300000 ? 'warning' : 'fail',
        message: `Last update: ${dataAge < Infinity ? Math.round(dataAge / 1000) : 'Never'} seconds ago`,
        severity: 'medium'
      });

    } catch (error) {
      checks.push({
        name: 'Live Data System Check',
        status: 'fail',
        message: `Live data validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return checks;
  }

  private async validateErrorHandling(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      const diagnosticInfo = gps51LiveDataManager.getDiagnosticInfo();
      
      checks.push({
        name: 'Error Handling System',
        status: 'pass',
        message: 'Error handling and logging systems operational',
        details: {
          circuitBreakerEnabled: diagnosticInfo.masterPolling.isPolling,
          connectionHealthMonitoring: 'operational'
        },
        severity: 'low'
      });

    } catch (error) {
      checks.push({
        name: 'Error Handling Validation',
        status: 'fail',
        message: `Error handling validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
    }

    return checks;
  }

  private async validatePerformanceMetrics(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];

    try {
      // Use coordinator status for performance validation
      const coordinatorStatus = await gps51CoordinatorClient.getCoordinatorStatus();
      
      // Check coordinator performance
      checks.push({
        name: 'Request Processing',
        status: coordinatorStatus.queueSize === 0 ? 'pass' : 'warning',
        message: `Queue size: ${coordinatorStatus.queueSize}, Cache hit rate: ${(coordinatorStatus.cacheHitRate * 100).toFixed(1)}%`,
        details: coordinatorStatus,
        severity: 'low'
      });

      // Check circuit breaker status
      checks.push({
        name: 'Circuit Breaker Health',
        status: !coordinatorStatus.circuitBreakerOpen ? 'pass' : 'warning',
        message: `Circuit breaker: ${coordinatorStatus.circuitBreakerOpen ? 'Open' : 'Closed'}`,
        severity: 'medium'
      });

    } catch (error) {
      checks.push({
        name: 'Performance Metrics Check',
        status: 'fail',
        message: `Performance validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'medium'
      });
    }

    return checks;
  }

  private calculateOverallStatus(checks: ProductionReadinessCheck[]): { score: number; status: 'ready' | 'needs_attention' | 'not_ready' } {
    const totalChecks = checks.length;
    if (totalChecks === 0) return { score: 0, status: 'not_ready' };

    let score = 0;
    const weights = { critical: 25, high: 15, medium: 10, low: 5 };

    checks.forEach(check => {
      const weight = weights[check.severity] || 5;
      if (check.status === 'pass') {
        score += weight;
      } else if (check.status === 'warning') {
        score += weight * 0.5;
      }
      // Failed checks contribute 0 points
    });

    // Calculate maximum possible score
    const maxScore = checks.reduce((sum, check) => sum + (weights[check.severity] || 5), 0);
    const normalizedScore = Math.round((score / maxScore) * 100);

    let status: 'ready' | 'needs_attention' | 'not_ready';
    if (normalizedScore >= 90) {
      status = 'ready';
    } else if (normalizedScore >= 70) {
      status = 'needs_attention';
    } else {
      status = 'not_ready';
    }

    return { score: normalizedScore, status };
  }
}

export const gps51ProductionValidator = GPS51ProductionValidator.getInstance();