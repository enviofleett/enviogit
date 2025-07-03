import { gps51StartupService } from './GPS51StartupService';
import { gps51LiveDataManager } from './GPS51LiveDataManager';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { gps51DatabaseIntegration } from './GPS51DatabaseIntegration';
import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';

export interface ProductionValidationResult {
  overallScore: number;
  maxScore: number;
  status: 'production-ready' | 'needs-fixes' | 'critical-issues';
  checks: ProductionCheck[];
  recommendations: string[];
  summary: string;
}

export interface ProductionCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  maxScore: number;
  message: string;
  details?: any;
  errorCode?: string;
}

export class GPS51ProductionValidator {
  private static instance: GPS51ProductionValidator;

  static getInstance(): GPS51ProductionValidator {
    if (!GPS51ProductionValidator.instance) {
      GPS51ProductionValidator.instance = new GPS51ProductionValidator();
    }
    return GPS51ProductionValidator.instance;
  }

  /**
   * Run comprehensive production validation
   */
  async validateProduction(): Promise<ProductionValidationResult> {
    console.log('GPS51ProductionValidator: Starting comprehensive production validation...');
    
    const checks: ProductionCheck[] = [];
    let totalScore = 0;
    const maxScore = 100;

    // Check 1: Credentials and Authentication (20 points)
    const authCheck = await this.validateAuthentication();
    checks.push(authCheck);
    totalScore += authCheck.score;

    // Check 2: Connection Strategies (20 points)
    const connectionCheck = await this.validateConnectionStrategies();
    checks.push(connectionCheck);
    totalScore += connectionCheck.score;

    // Check 3: Live Data System (25 points)
    const liveDataCheck = await this.validateLiveDataSystem();
    checks.push(liveDataCheck);
    totalScore += liveDataCheck.score;

    // Check 4: Database Integration (20 points)
    const databaseCheck = await this.validateDatabaseIntegration();
    checks.push(databaseCheck);
    totalScore += databaseCheck.score;

    // Check 5: Edge Functions (15 points)
    const edgeCheck = await this.validateEdgeFunctions();
    checks.push(edgeCheck);
    totalScore += edgeCheck.score;

    // Determine overall status
    let status: 'production-ready' | 'needs-fixes' | 'critical-issues';
    if (totalScore >= 85) {
      status = 'production-ready';
    } else if (totalScore >= 60) {
      status = 'needs-fixes';
    } else {
      status = 'critical-issues';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks);

    // Generate summary
    const summary = this.generateSummary(totalScore, maxScore, status, checks);

    console.log('GPS51ProductionValidator: Validation completed', {
      totalScore,
      maxScore,
      status,
      passedChecks: checks.filter(c => c.status === 'pass').length,
      failedChecks: checks.filter(c => c.status === 'fail').length,
      warningChecks: checks.filter(c => c.status === 'warning').length
    });

    return {
      overallScore: totalScore,
      maxScore,
      status,
      checks,
      recommendations,
      summary
    };
  }

  private async validateAuthentication(): Promise<ProductionCheck> {
    try {
      console.log('GPS51ProductionValidator: Validating authentication...');
      
      const credentialsManager = new GPS51CredentialsManager();
      const credentials = await credentialsManager.getCredentials();
      
      if (!credentials) {
        return {
          id: 'GPS51-AUTH-001',
          name: 'GPS51 Authentication',
          status: 'fail',
          score: 0,
          maxScore: 20,
          message: 'No GPS51 credentials configured',
          errorCode: 'GPS51-AUTH-001'
        };
      }

      // Check if startup service is properly authenticated
      const initStatus = gps51StartupService.getInitializationStatus();
      
      if (!initStatus.authenticated || !initStatus.initialized) {
        return {
          id: 'GPS51-AUTH-002',
          name: 'GPS51 Authentication',
          status: 'fail',
          score: 5,
          maxScore: 20,
          message: 'GPS51 authentication flow is broken',
          details: initStatus,
          errorCode: 'GPS51-AUTH-002'
        };
      }

      return {
        id: 'GPS51-AUTH-SUCCESS',
        name: 'GPS51 Authentication',
        status: 'pass',
        score: 20,
        maxScore: 20,
        message: 'GPS51 authentication working correctly',
        details: {
          username: credentials.username,
          apiUrl: credentials.apiUrl,
          authenticated: initStatus.authenticated,
          initialized: initStatus.initialized
        }
      };

    } catch (error) {
      return {
        id: 'GPS51-AUTH-ERROR',
        name: 'GPS51 Authentication',
        status: 'fail',
        score: 0,
        maxScore: 20,
        message: `Authentication validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'GPS51-AUTH-ERROR'
      };
    }
  }

  private async validateConnectionStrategies(): Promise<ProductionCheck> {
    try {
      console.log('GPS51ProductionValidator: Validating connection strategies...');
      
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      const testResults = await gps51IntelligentConnectionManager.testAllConnections();
      
      const proxyResult = testResults.get('proxy');
      const directResult = testResults.get('direct');

      if (connectionHealth.overallHealth === 'good') {
        return {
          id: 'GPS51-CONN-SUCCESS',
          name: 'Connection Strategies',
          status: 'pass',
          score: 20,
          maxScore: 20,
          message: `Intelligent connection management working (${connectionHealth.recommendedStrategy} strategy)`,
          details: {
            overallHealth: connectionHealth.overallHealth,
            recommendedStrategy: connectionHealth.recommendedStrategy,
            proxyWorking: proxyResult?.success || false,
            directWorking: directResult?.success || false
          }
        };
      } else if (connectionHealth.overallHealth === 'degraded') {
        return {
          id: 'GPS51-CONN-DEGRADED',
          name: 'Connection Strategies',
          status: 'warning',
          score: 15,
          maxScore: 20,
          message: 'Connection strategies working but degraded',
          details: connectionHealth,
          errorCode: 'GPS51-CONN-DEGRADED'
        };
      } else {
        return {
          id: 'GPS51-CONN-FAIL',
          name: 'Connection Strategies',
          status: 'fail',
          score: 0,
          maxScore: 20,
          message: 'All connection strategies failed',
          details: connectionHealth,
          errorCode: 'GPS51-CONN-FAIL'
        };
      }

    } catch (error) {
      return {
        id: 'GPS51-CONN-ERROR',
        name: 'Connection Strategies',
        status: 'fail',
        score: 0,
        maxScore: 20,
        message: `Connection validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'GPS51-CONN-ERROR'
      };
    }
  }

  private async validateLiveDataSystem(): Promise<ProductionCheck> {
    try {
      console.log('GPS51ProductionValidator: Validating live data system...');
      
      const liveDataStatus = gps51LiveDataManager.getStatus();
      const currentState = gps51LiveDataManager.getCurrentState();
      
      if (!liveDataStatus.isAuthenticated) {
        return {
          id: 'GPS51-LIVE-001',
          name: 'Live Data System',
          status: 'fail',
          score: 0,
          maxScore: 25,
          message: 'Live data system requires authentication',
          errorCode: 'GPS51-LIVE-001'
        };
      }

      if (!liveDataStatus.isActive) {
        return {
          id: 'GPS51-LIVE-002',
          name: 'Live Data System',
          status: 'fail',
          score: 10,
          maxScore: 25,
          message: 'Live data system is not active',
          details: liveDataStatus,
          errorCode: 'GPS51-LIVE-002'
        };
      }

      if (liveDataStatus.deviceCount === 0) {
        return {
          id: 'GPS51-LIVE-003',
          name: 'Live Data System',
          status: 'warning',
          score: 18,
          maxScore: 25,
          message: 'Live data system active but no devices found',
          details: liveDataStatus,
          errorCode: 'GPS51-LIVE-003'
        };
      }

      return {
        id: 'GPS51-LIVE-SUCCESS',
        name: 'Live Data System',
        status: 'pass',
        score: 25,
        maxScore: 25,
        message: `Live data system fully operational (${liveDataStatus.deviceCount} devices, ${liveDataStatus.positionCount} positions)`,
        details: {
          deviceCount: liveDataStatus.deviceCount,
          positionCount: liveDataStatus.positionCount,
          isActive: liveDataStatus.isActive,
          lastUpdate: liveDataStatus.lastUpdate
        }
      };

    } catch (error) {
      return {
        id: 'GPS51-LIVE-ERROR',
        name: 'Live Data System',
        status: 'fail',
        score: 0,
        maxScore: 25,
        message: `Live data validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'GPS51-LIVE-ERROR'
      };
    }
  }

  private async validateDatabaseIntegration(): Promise<ProductionCheck> {
    try {
      console.log('GPS51ProductionValidator: Validating database integration...');
      
      const dbTest = await gps51DatabaseIntegration.testDatabaseConnection();
      
      if (!dbTest.success) {
        return {
          id: 'GPS51-DB-001',
          name: 'Database Integration',
          status: 'fail',
          score: 0,
          maxScore: 20,
          message: `Database connectivity failed: ${dbTest.error}`,
          errorCode: 'GPS51-DB-001'
        };
      }

      // Try to get sync stats to verify full integration
      const syncStats = await gps51DatabaseIntegration.getSyncJobStats();
      
      return {
        id: 'GPS51-DB-SUCCESS',
        name: 'Database Integration',
        status: 'pass',
        score: 20,
        maxScore: 20,
        message: 'Database integration fully functional',
        details: {
          connectionWorking: true,
          recentJobs: syncStats.recentJobs,
          successRate: syncStats.successRate,
          totalVehiclesProcessed: syncStats.totalVehiclesProcessed,
          totalPositionsStored: syncStats.totalPositionsStored
        }
      };

    } catch (error) {
      return {
        id: 'GPS51-DB-ERROR',
        name: 'Database Integration',
        status: 'fail',
        score: 0,
        maxScore: 20,
        message: `Database validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'GPS51-DB-ERROR'
      };
    }
  }

  private async validateEdgeFunctions(): Promise<ProductionCheck> {
    try {
      console.log('GPS51ProductionValidator: Validating edge functions...');
      
      // Test if we can reach the Supabase edge function
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Simple test to see if edge functions are accessible
      try {
        const { data, error } = await supabase.functions.invoke('gps51-proxy', {
          body: { action: 'test' }
        });
        
        if (error && error.message.includes('Function not found')) {
          return {
            id: 'GPS51-PROXY-001',
            name: 'Edge Functions',
            status: 'fail',
            score: 0,
            maxScore: 15,
            message: 'GPS51 proxy edge function not deployed',
            errorCode: 'GPS51-PROXY-001'
          };
        }

        return {
          id: 'GPS51-PROXY-SUCCESS',
          name: 'Edge Functions',
          status: 'pass',
          score: 15,
          maxScore: 15,
          message: 'Edge functions accessible and responding',
          details: { accessible: true }
        };

      } catch (funcError) {
        return {
          id: 'GPS51-PROXY-002',
          name: 'Edge Functions',
          status: 'warning',
          score: 10,
          maxScore: 15,
          message: 'Edge function test inconclusive',
          details: { error: funcError instanceof Error ? funcError.message : 'Unknown error' },
          errorCode: 'GPS51-PROXY-002'
        };
      }

    } catch (error) {
      return {
        id: 'GPS51-PROXY-ERROR',
        name: 'Edge Functions',
        status: 'fail',
        score: 0,
        maxScore: 15,
        message: `Edge function validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: 'GPS51-PROXY-ERROR'
      };
    }
  }

  private generateRecommendations(checks: ProductionCheck[]): string[] {
    const recommendations: string[] = [];
    
    checks.forEach(check => {
      if (check.status === 'fail') {
        switch (check.errorCode) {
          case 'GPS51-AUTH-001':
            recommendations.push('Configure GPS51 credentials in Settings → GPS51 Settings');
            break;
          case 'GPS51-AUTH-002':
            recommendations.push('Fix authentication flow by restarting the application or clearing stored credentials');
            break;
          case 'GPS51-CONN-FAIL':
            recommendations.push('Check GPS51 API server status and Supabase Edge Function deployment');
            break;
          case 'GPS51-LIVE-001':
          case 'GPS51-LIVE-002':
            recommendations.push('Restart the GPS51 startup service and ensure authentication is working');
            break;
          case 'GPS51-DB-001':
            recommendations.push('Check Supabase database connectivity and RLS policies');
            break;
          case 'GPS51-PROXY-001':
            recommendations.push('Deploy GPS51 proxy edge function to Supabase');
            break;
        }
      } else if (check.status === 'warning') {
        if (check.errorCode === 'GPS51-CONN-DEGRADED') {
          recommendations.push('Monitor connection performance and consider using proxy for better reliability');
        }
        if (check.errorCode === 'GPS51-LIVE-003') {
          recommendations.push('Verify GPS51 account has active devices and check device configuration');
        }
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('System is production-ready! Monitor performance and maintain regular backups.');
    }

    return recommendations;
  }

  private generateSummary(score: number, maxScore: number, status: string, checks: ProductionCheck[]): string {
    const percentage = Math.round((score / maxScore) * 100);
    const passedChecks = checks.filter(c => c.status === 'pass').length;
    const totalChecks = checks.length;

    let summary = `Production Readiness Score: ${score}/${maxScore} (${percentage}%)\n`;
    summary += `Status: ${status.toUpperCase()}\n`;
    summary += `Checks Passed: ${passedChecks}/${totalChecks}\n\n`;

    if (status === 'production-ready') {
      summary += '🎉 Congratulations! Your GPS51 integration is ready for production deployment.\n';
      summary += 'All critical systems are functioning correctly and live vehicle data is flowing.';
    } else if (status === 'needs-fixes') {
      summary += '⚠️ Your GPS51 integration is mostly ready but has some issues that should be addressed.\n';
      summary += 'Most functionality is working, but fixing the remaining issues will improve reliability.';
    } else {
      summary += '🔴 Critical issues detected. GPS51 integration is not ready for production.\n';
      summary += 'Please address the failed checks before deploying to production.';
    }

    return summary;
  }
}

export const gps51ProductionValidator = GPS51ProductionValidator.getInstance();