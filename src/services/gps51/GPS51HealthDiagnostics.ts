/**
 * GPS51 Health Diagnostics Service
 * Comprehensive monitoring and validation of GPS51 integration health
 */

import { gps51UnifiedAuthManager } from './unified/GPS51UnifiedAuthManager';
import { GPS51ProductionService } from './GPS51ProductionService';

export interface GPS51HealthReport {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    authentication: GPS51ComponentHealth;
    edgeFunction: GPS51ComponentHealth;
    tokenManagement: GPS51ComponentHealth;
    dataFetching: GPS51ComponentHealth;
    webSocketPrevention: GPS51ComponentHealth;
  };
  summary: {
    successRate: number;
    lastSuccessfulAuth: Date | null;
    totalErrors: number;
    recommendations: string[];
  };
  timestamp: Date;
}

export interface GPS51ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical';
  message: string;
  details?: any;
  lastTested?: Date;
}

export class GPS51HealthDiagnostics {
  private static instance: GPS51HealthDiagnostics;
  
  static getInstance(): GPS51HealthDiagnostics {
    if (!GPS51HealthDiagnostics.instance) {
      GPS51HealthDiagnostics.instance = new GPS51HealthDiagnostics();
    }
    return GPS51HealthDiagnostics.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<GPS51HealthReport> {
    console.log('GPS51HealthDiagnostics: Starting comprehensive health check...');
    
    const startTime = Date.now();
    const components = {
      authentication: await this.checkAuthentication(),
      edgeFunction: await this.checkEdgeFunction(),
      tokenManagement: this.checkTokenManagement(),
      dataFetching: await this.checkDataFetching(),
      webSocketPrevention: this.checkWebSocketPrevention()
    };

    // Calculate overall health
    const healthyCount = Object.values(components).filter(c => c.status === 'healthy').length;
    const totalCount = Object.values(components).length;
    const successRate = (healthyCount / totalCount) * 100;

    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (successRate < 50) {
      overall = 'critical';
    } else if (successRate < 80) {
      overall = 'degraded';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(components);

    const report: GPS51HealthReport = {
      overall,
      components,
      summary: {
        successRate,
        lastSuccessfulAuth: this.getLastSuccessfulAuth(),
        totalErrors: this.countErrors(components),
        recommendations
      },
      timestamp: new Date()
    };

    const duration = Date.now() - startTime;
    console.log(`GPS51HealthDiagnostics: Health check completed in ${duration}ms`, {
      overall: report.overall,
      successRate: `${report.summary.successRate.toFixed(1)}%`,
      recommendations: report.summary.recommendations.length
    });

    return report;
  }

  /**
   * Check authentication health
   */
  private async checkAuthentication(): Promise<GPS51ComponentHealth> {
    try {
      const authState = gps51UnifiedAuthManager.getAuthState();
      
      if (authState.isAuthenticated && authState.token) {
        return {
          status: 'healthy',
          message: 'Authentication active with valid token',
          details: {
            username: authState.username,
            tokenLength: authState.token.length,
            tokenExpiry: authState.tokenExpiry,
            hasCredentials: !!authState.credentials
          },
          lastTested: new Date()
        };
      } else if (authState.credentials) {
        return {
          status: 'degraded',
          message: 'Authentication credentials available but no active token',
          details: {
            hasCredentials: true,
            username: authState.username,
            error: authState.error
          },
          lastTested: new Date()
        };
      } else {
        return {
          status: 'critical',
          message: 'No authentication credentials or active session',
          details: {
            authState,
            error: 'Authentication required'
          },
          lastTested: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: 'Authentication check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        lastTested: new Date()
      };
    }
  }

  /**
   * Check Edge Function health
   */
  private async checkEdgeFunction(): Promise<GPS51ComponentHealth> {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Simple health check to Edge Function
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'login',
          username: 'health-check',
          password: 'c870255d7bfd5f284e12c61bbefe8fa9', // MD5 of 'health-check'
          from: 'WEB',
          type: 'USER',
          apiUrl: 'https://api.gps51.com/openapi'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        return {
          status: 'critical',
          message: 'Edge Function invocation failed',
          details: {
            error: error.message,
            responseTime
          },
          lastTested: new Date()
        };
      }
      
      if (!data) {
        return {
          status: 'critical',
          message: 'Edge Function returned no data',
          details: { responseTime },
          lastTested: new Date()
        };
      }
      
      // Even failed auth is OK for health check - we just want to ensure the function responds
      return {
        status: 'healthy',
        message: 'Edge Function responding correctly',
        details: {
          responseTime,
          hasResponse: true,
          responseType: typeof data
        },
        lastTested: new Date()
      };
      
    } catch (error) {
      return {
        status: 'critical',
        message: 'Edge Function health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        lastTested: new Date()
      };
    }
  }

  /**
   * Check token management health
   */
  private checkTokenManagement(): GPS51ComponentHealth {
    try {
      const authState = gps51UnifiedAuthManager.getAuthState();
      const legacyToken = localStorage.getItem('gps51_token');
      const legacyUsername = localStorage.getItem('gps51_username');
      
      if (authState.token && legacyToken && authState.token === legacyToken) {
        return {
          status: 'healthy',
          message: 'Token management synchronized across all systems',
          details: {
            unifiedToken: !!authState.token,
            legacyToken: !!legacyToken,
            tokensMatch: authState.token === legacyToken,
            username: authState.username
          },
          lastTested: new Date()
        };
      } else if (authState.token || legacyToken) {
        return {
          status: 'degraded',
          message: 'Token synchronization issues detected',
          details: {
            unifiedToken: !!authState.token,
            legacyToken: !!legacyToken,
            tokensMatch: authState.token === legacyToken,
            issue: 'Token synchronization mismatch'
          },
          lastTested: new Date()
        };
      } else {
        return {
          status: 'critical',
          message: 'No tokens available in any system',
          details: {
            unifiedToken: false,
            legacyToken: false,
            issue: 'No authentication tokens found'
          },
          lastTested: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: 'Token management check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        lastTested: new Date()
      };
    }
  }

  /**
   * Check data fetching health
   */
  private async checkDataFetching(): Promise<GPS51ComponentHealth> {
    try {
      const productionService = GPS51ProductionService.getInstance();
      const authState = productionService.getAuthState();
      
      if (!authState.isAuthenticated) {
        return {
          status: 'degraded',
          message: 'Cannot test data fetching - not authenticated',
          details: {
            reason: 'Authentication required for data fetching test'
          },
          lastTested: new Date()
        };
      }
      
      // Check if we can get vehicles count (lightweight operation)
      const vehicles = productionService.getVehicles();
      
      return {
        status: 'healthy',
        message: 'Data fetching service operational',
        details: {
          vehicleCount: vehicles.length,
          lastQueryTime: productionService.getLastQueryTime(),
          serviceReady: true
        },
        lastTested: new Date()
      };
      
    } catch (error) {
      return {
        status: 'critical',
        message: 'Data fetching check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        lastTested: new Date()
      };
    }
  }

  /**
   * Check WebSocket prevention health
   */
  private checkWebSocketPrevention(): GPS51ComponentHealth {
    try {
      const { gps51WebSocketPrevention } = require('./GPS51WebSocketPrevention');
      
      if (gps51WebSocketPrevention?.isPreventionActive()) {
        return {
          status: 'healthy',
          message: 'WebSocket prevention active - no console errors',
          details: {
            preventionActive: true,
            reason: 'GPS51 uses polling, not WebSockets'
          },
          lastTested: new Date()
        };
      } else {
        return {
          status: 'degraded',
          message: 'WebSocket prevention not active - potential console errors',
          details: {
            preventionActive: false,
            recommendation: 'WebSocket prevention helps reduce console noise'
          },
          lastTested: new Date()
        };
      }
    } catch (error) {
      return {
        status: 'degraded',
        message: 'WebSocket prevention check inconclusive',
        details: {
          error: error instanceof Error ? error.message : 'Module not found',
          impact: 'Minor - only affects console output'
        },
        lastTested: new Date()
      };
    }
  }

  /**
   * Generate health-based recommendations
   */
  private generateRecommendations(components: GPS51HealthReport['components']): string[] {
    const recommendations: string[] = [];
    
    if (components.authentication.status === 'critical') {
      recommendations.push('Authenticate with GPS51 credentials to restore functionality');
    }
    
    if (components.edgeFunction.status === 'critical') {
      recommendations.push('Check Supabase Edge Function deployment and logs');
    }
    
    if (components.tokenManagement.status === 'degraded') {
      recommendations.push('Re-authenticate to synchronize token management');
    }
    
    if (components.dataFetching.status === 'critical') {
      recommendations.push('Verify GPS51 API connectivity and credentials');
    }
    
    if (components.webSocketPrevention.status === 'degraded') {
      recommendations.push('Enable WebSocket prevention to reduce console errors');
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('All systems operational - no action required');
    } else if (recommendations.length > 2) {
      recommendations.push('Consider full system restart or re-authentication');
    }
    
    return recommendations;
  }

  /**
   * Get last successful authentication time
   */
  private getLastSuccessfulAuth(): Date | null {
    try {
      const authState = gps51UnifiedAuthManager.getAuthState();
      return authState.lastLoginTime || null;
    } catch {
      return null;
    }
  }

  /**
   * Count total errors across components
   */
  private countErrors(components: GPS51HealthReport['components']): number {
    return Object.values(components).filter(c => c.status === 'critical').length;
  }
}

// Export singleton
export const gps51HealthDiagnostics = GPS51HealthDiagnostics.getInstance();