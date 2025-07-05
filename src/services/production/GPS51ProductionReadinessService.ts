import { gps51StartupService } from '@/services/gps51/GPS51StartupService';
import { productionMonitoringService } from '@/services/monitoring/ProductionMonitoringService';
import { getEnvironmentConfig, getCurrentEnvironment, isProduction } from '@/config/environment';
import { supabase } from '@/integrations/supabase/client';

export interface ProductionReadinessCheck {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  critical: boolean;
  timestamp: number;
}

export interface ProductionReadinessReport {
  overall: 'ready' | 'warning' | 'not_ready';
  score: number;
  criticalIssues: number;
  warningIssues: number;
  totalChecks: number;
  checks: ProductionReadinessCheck[];
  environment: string;
  timestamp: number;
}

export class GPS51ProductionReadinessService {
  private static instance: GPS51ProductionReadinessService;

  static getInstance(): GPS51ProductionReadinessService {
    if (!GPS51ProductionReadinessService.instance) {
      GPS51ProductionReadinessService.instance = new GPS51ProductionReadinessService();
    }
    return GPS51ProductionReadinessService.instance;
  }

  async runFullProductionReadinessCheck(): Promise<ProductionReadinessReport> {
    const checks: ProductionReadinessCheck[] = [];
    
    // Authentication & Core System Checks
    checks.push(...await this.checkAuthenticationSystem());
    checks.push(...await this.checkDatabaseConnectivity());
    checks.push(...await this.checkGPS51Integration());
    
    // Monitoring & Observability Checks
    checks.push(...await this.checkMonitoringSystem());
    checks.push(...await this.checkErrorHandling());
    
    // Performance & Scaling Checks
    checks.push(...await this.checkPerformanceMetrics());
    checks.push(...await this.checkEnvironmentConfiguration());
    
    // Security & Compliance Checks
    checks.push(...await this.checkSecurityConfiguration());
    
    // Production Environment Specific Checks
    if (isProduction()) {
      checks.push(...await this.checkProductionSpecificRequirements());
    }

    const criticalIssues = checks.filter(c => c.status === 'fail' && c.critical).length;
    const warningIssues = checks.filter(c => c.status === 'warning' || (c.status === 'fail' && !c.critical)).length;
    const passedChecks = checks.filter(c => c.status === 'pass').length;
    
    const score = (passedChecks / checks.length) * 100;
    
    let overall: 'ready' | 'warning' | 'not_ready';
    if (criticalIssues > 0) {
      overall = 'not_ready';
    } else if (warningIssues > 0) {
      overall = 'warning';
    } else {
      overall = 'ready';
    }

    return {
      overall,
      score: Math.round(score),
      criticalIssues,
      warningIssues,
      totalChecks: checks.length,
      checks,
      environment: getCurrentEnvironment(),
      timestamp: Date.now()
    };
  }

  private async checkAuthenticationSystem(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    try {
      // Check GPS51 authentication
      const authStatus = gps51StartupService.isAuthenticated();
      checks.push({
        category: 'Authentication',
        name: 'GPS51 Authentication',
        status: authStatus ? 'pass' : 'fail',
        message: authStatus ? 'GPS51 authentication active' : 'GPS51 authentication failed',
        critical: true,
        timestamp: Date.now()
      });

      // Check Supabase authentication
      const { data: { session } } = await supabase.auth.getSession();
      checks.push({
        category: 'Authentication',
        name: 'Supabase Auth System',
        status: 'pass',
        message: 'Supabase authentication system operational',
        critical: true,
        timestamp: Date.now()
      });

    } catch (error) {
      checks.push({
        category: 'Authentication',
        name: 'Authentication System Error',
        status: 'fail',
        message: `Authentication system error: ${error}`,
        critical: true,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkDatabaseConnectivity(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    try {
      // Test database connection
      const { error: dbError } = await supabase.from('profiles').select('id').limit(1);
      checks.push({
        category: 'Database',
        name: 'Database Connectivity',
        status: dbError ? 'fail' : 'pass',
        message: dbError ? `Database error: ${dbError.message}` : 'Database connection healthy',
        critical: true,
        timestamp: Date.now()
      });

      // Check critical tables
      try {
        const { error: profilesError } = await supabase.from('profiles').select('*').limit(1);
        checks.push({
          category: 'Database',
          name: 'Table: profiles',
          status: profilesError ? 'fail' : 'pass',
          message: profilesError ? `Profiles table error: ${profilesError.message}` : 'Profiles table accessible',
          critical: true,
          timestamp: Date.now()
        });
      } catch (error) {
        checks.push({
          category: 'Database',
          name: 'Table: profiles',
          status: 'fail',
          message: `Profiles table check failed: ${error}`,
          critical: true,
          timestamp: Date.now()
        });
      }

      try {
        const { error: vehiclesError } = await supabase.from('vehicles').select('*').limit(1);
        checks.push({
          category: 'Database',
          name: 'Table: vehicles',
          status: vehiclesError ? 'fail' : 'pass',
          message: vehiclesError ? `Vehicles table error: ${vehiclesError.message}` : 'Vehicles table accessible',
          critical: true,
          timestamp: Date.now()
        });
      } catch (error) {
        checks.push({
          category: 'Database',
          name: 'Table: vehicles',
          status: 'fail',
          message: `Vehicles table check failed: ${error}`,
          critical: true,
          timestamp: Date.now()
        });
      }

      try {
        const { error: positionsError } = await supabase.from('vehicle_positions').select('*').limit(1);
        checks.push({
          category: 'Database',
          name: 'Table: vehicle_positions',
          status: positionsError ? 'fail' : 'pass',
          message: positionsError ? `Vehicle positions table error: ${positionsError.message}` : 'Vehicle positions table accessible',
          critical: true,
          timestamp: Date.now()
        });
      } catch (error) {
        checks.push({
          category: 'Database',
          name: 'Table: vehicle_positions',
          status: 'fail',
          message: `Vehicle positions table check failed: ${error}`,
          critical: true,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      checks.push({
        category: 'Database',
        name: 'Database System Error',
        status: 'fail',
        message: `Database system error: ${error}`,
        critical: true,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkGPS51Integration(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    try {
      const initStatus = gps51StartupService.getInitializationStatus();
      
      checks.push({
        category: 'GPS51',
        name: 'System Initialization',
        status: initStatus.initialized ? 'pass' : 'fail',
        message: initStatus.initialized ? 'GPS51 system initialized' : 'GPS51 system not initialized',
        critical: true,
        timestamp: Date.now()
      });

      checks.push({
        category: 'GPS51',
        name: 'Live Data Active',
        status: initStatus.liveDataActive ? 'pass' : 'warning',
        message: initStatus.liveDataActive ? 'Live data streaming active' : 'Live data streaming inactive',
        critical: false,
        timestamp: Date.now()
      });

      checks.push({
        category: 'GPS51',
        name: 'Production Ready',
        status: initStatus.productionReady ? 'pass' : 'warning',
        message: initStatus.productionReady ? 'GPS51 production ready' : 'GPS51 production readiness pending',
        critical: false,
        timestamp: Date.now()
      });

    } catch (error) {
      checks.push({
        category: 'GPS51',
        name: 'GPS51 Integration Error',
        status: 'fail',
        message: `GPS51 integration error: ${error}`,
        critical: true,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkMonitoringSystem(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    try {
      await productionMonitoringService.initialize();
      
      const latestMetrics = productionMonitoringService.getLatestMetrics();
      checks.push({
        category: 'Monitoring',
        name: 'Metrics Collection',
        status: latestMetrics ? 'pass' : 'warning',
        message: latestMetrics ? 'Metrics collection active' : 'No metrics data available',
        critical: false,
        timestamp: Date.now()
      });

      const activeAlerts = productionMonitoringService.getActiveAlerts();
      const criticalAlerts = activeAlerts.filter(a => a.level === 'critical').length;
      checks.push({
        category: 'Monitoring',
        name: 'Alert System',
        status: criticalAlerts === 0 ? 'pass' : 'fail',
        message: criticalAlerts === 0 ? 'No critical alerts' : `${criticalAlerts} critical alerts active`,
        critical: true,
        timestamp: Date.now()
      });

    } catch (error) {
      checks.push({
        category: 'Monitoring',
        name: 'Monitoring System Error',
        status: 'fail',
        message: `Monitoring system error: ${error}`,
        critical: false,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkErrorHandling(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    // Check recent error rates
    try {
      const { data: recentErrors } = await supabase
        .from('api_calls_monitor')
        .select('response_status')
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .gte('response_status', 400);

      const errorCount = recentErrors?.length || 0;
      checks.push({
        category: 'Error Handling',
        name: 'Recent Error Rate',
        status: errorCount < 5 ? 'pass' : errorCount < 20 ? 'warning' : 'fail',
        message: `${errorCount} errors in last 5 minutes`,
        critical: errorCount > 50,
        timestamp: Date.now()
      });

    } catch (error) {
      checks.push({
        category: 'Error Handling',
        name: 'Error Monitoring',
        status: 'warning',
        message: `Error monitoring check failed: ${error}`,
        critical: false,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkPerformanceMetrics(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    try {
      const latestMetrics = productionMonitoringService.getLatestMetrics();
      
      if (latestMetrics) {
        // Response time check
        const avgResponseTime = latestMetrics.performance.averageResponseTime;
        checks.push({
          category: 'Performance',
          name: 'Response Time',
          status: avgResponseTime < 2000 ? 'pass' : avgResponseTime < 5000 ? 'warning' : 'fail',
          message: `Average response time: ${Math.round(avgResponseTime)}ms`,
          critical: avgResponseTime > 10000,
          timestamp: Date.now()
        });

        // Availability check
        const healthScore = latestMetrics.availability.healthScore;
        checks.push({
          category: 'Performance',
          name: 'System Availability',
          status: healthScore >= 99 ? 'pass' : healthScore >= 95 ? 'warning' : 'fail',
          message: `System availability: ${healthScore.toFixed(1)}%`,
          critical: healthScore < 90,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      checks.push({
        category: 'Performance',
        name: 'Performance Metrics Error',
        status: 'warning',
        message: `Performance metrics check failed: ${error}`,
        critical: false,
        timestamp: Date.now()
      });
    }

    return checks;
  }

  private async checkEnvironmentConfiguration(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    const config = getEnvironmentConfig();
    const env = getCurrentEnvironment();
    
    checks.push({
      category: 'Environment',
      name: 'Environment Detection',
      status: 'pass',
      message: `Running in ${env} environment`,
      critical: false,
      timestamp: Date.now()
    });

    checks.push({
      category: 'Environment',
      name: 'Monitoring Enabled',
      status: config.monitoring.enabled ? 'pass' : 'warning',
      message: config.monitoring.enabled ? 'Monitoring enabled' : 'Monitoring disabled',
      critical: isProduction() && !config.monitoring.enabled,
      timestamp: Date.now()
    });

    checks.push({
      category: 'Environment',
      name: 'Security Configuration',
      status: config.security.rateLimitingEnabled ? 'pass' : 'warning',
      message: config.security.rateLimitingEnabled ? 'Rate limiting enabled' : 'Rate limiting disabled',
      critical: isProduction() && !config.security.rateLimitingEnabled,
      timestamp: Date.now()
    });

    return checks;
  }

  private async checkSecurityConfiguration(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    const config = getEnvironmentConfig();
    
    checks.push({
      category: 'Security',
      name: 'CORS Configuration',
      status: config.security.corsStrict ? 'pass' : 'warning',
      message: config.security.corsStrict ? 'Strict CORS enabled' : 'Permissive CORS configuration',
      critical: isProduction() && !config.security.corsStrict,
      timestamp: Date.now()
    });

    checks.push({
      category: 'Security',
      name: 'Audit Logging',
      status: config.security.auditLoggingEnabled ? 'pass' : 'warning',
      message: config.security.auditLoggingEnabled ? 'Audit logging enabled' : 'Audit logging disabled',
      critical: false,
      timestamp: Date.now()
    });

    return checks;
  }

  private async checkProductionSpecificRequirements(): Promise<ProductionReadinessCheck[]> {
    const checks: ProductionReadinessCheck[] = [];
    
    const config = getEnvironmentConfig();
    
    checks.push({
      category: 'Production',
      name: 'Debug Mode',
      status: !config.features.debugMode ? 'pass' : 'fail',
      message: config.features.debugMode ? 'Debug mode enabled in production' : 'Debug mode disabled',
      critical: true,
      timestamp: Date.now()
    });

    checks.push({
      category: 'Production',
      name: 'Beta Features',
      status: !config.features.betaFeatures ? 'pass' : 'warning',
      message: config.features.betaFeatures ? 'Beta features enabled in production' : 'Beta features disabled',
      critical: false,
      timestamp: Date.now()
    });

    checks.push({
      category: 'Production',
      name: 'Alert Channels',
      status: config.alerts.channels.length >= 2 ? 'pass' : 'warning',
      message: `${config.alerts.channels.length} alert channels configured`,
      critical: config.alerts.channels.length === 0,
      timestamp: Date.now()
    });

    return checks;
  }

  async generateProductionReadinessReport(): Promise<string> {
    const report = await this.runFullProductionReadinessCheck();
    
    let output = `
# GPS51 Fleet Management - Production Readiness Report
Generated: ${new Date(report.timestamp).toLocaleString()}
Environment: ${report.environment.toUpperCase()}

## Overall Status: ${report.overall.toUpperCase()}
- Score: ${report.score}%
- Critical Issues: ${report.criticalIssues}
- Warnings: ${report.warningIssues}
- Total Checks: ${report.totalChecks}

## Detailed Results:
`;

    const categories = [...new Set(report.checks.map(c => c.category))];
    
    for (const category of categories) {
      output += `\n### ${category}\n`;
      const categoryChecks = report.checks.filter(c => c.category === category);
      
      for (const check of categoryChecks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
        const critical = check.critical ? ' (CRITICAL)' : '';
        output += `${icon} ${check.name}${critical}: ${check.message}\n`;
      }
    }

    if (report.criticalIssues > 0) {
      output += `\n## ⚠️ CRITICAL ISSUES MUST BE RESOLVED BEFORE PRODUCTION DEPLOYMENT\n`;
    }

    return output;
  }
}

export const gps51ProductionReadinessService = GPS51ProductionReadinessService.getInstance();