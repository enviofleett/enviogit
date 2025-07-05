import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';

/**
 * Handles GPS51 connection testing with production-grade diagnostics
 */
export class GPS51ConnectionTester {
  /**
   * Test connection using unified service with production-grade diagnostics
   */
  async testConnection(apiUrl?: string, authenticationState?: { isAuthenticated: boolean; hasToken: boolean }): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    try {
      console.log('GPS51ConnectionTester: Testing production-ready connection...');

      // Get baseline health status
      const baseHealthStatus = gps51IntelligentConnectionManager.getConnectionHealth();

      // Run comprehensive connection tests
      const testResults = await gps51IntelligentConnectionManager.testAllConnections(apiUrl);

      const proxyResult = testResults.get('proxy');
      const directResult = testResults.get('direct');

      // CRITICAL FIX: Consider authentication state in health assessment
      const isAuthenticated = authenticationState?.isAuthenticated || false;
      const hasValidToken = authenticationState?.hasToken || false;

      // Enhanced health analysis with authentication state
      const enhancedHealthStatus = {
        ...baseHealthStatus,
        connectionTests: {
          proxy: {
            success: proxyResult?.success || false,
            responseTime: proxyResult?.responseTime || 0,
            error: this.formatConnectionError(proxyResult?.error, 'proxy')
          },
          direct: {
            success: directResult?.success || false,
            responseTime: directResult?.responseTime || 0,
            error: this.formatConnectionError(directResult?.error, 'direct')
          }
        },
        // CRITICAL FIX: Base overall health on both connection AND authentication
        overallHealth: this.calculateOverallHealth(proxyResult, directResult, isAuthenticated, hasValidToken),
        recommendedStrategy: proxyResult?.success ? 'proxy' : directResult?.success ? 'direct' : 'troubleshooting_needed',
        productionReadiness: this.assessProductionReadiness(proxyResult, isAuthenticated, hasValidToken),
        authenticationState: {
          isAuthenticated,
          hasValidToken,
          impact: isAuthenticated ? 'Authenticated - Full functionality available' : 'Not authenticated - Limited functionality'
        }
      };

      console.log('GPS51ConnectionTester: Enhanced connection test results:', enhancedHealthStatus);

      return {
        success: proxyResult?.success || directResult?.success || false,
        responseTime: proxyResult?.responseTime || directResult?.responseTime || 0,
        error: proxyResult?.error || directResult?.error,
        healthStatus: enhancedHealthStatus
      };
    } catch (error) {
      console.error('GPS51ConnectionTester: Connection test failed:', error);
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Connection test failed',
        healthStatus: {
          overallHealth: 'Error',
          error: error instanceof Error ? error.message : 'Unknown error',
          productionReadiness: 'Not Ready'
        }
      };
    }
  }

  /**
   * Format connection errors to be more user-friendly
   */
  private formatConnectionError(error?: string, strategy?: string): string | undefined {
    if (!error) return undefined;
    
    if (strategy === 'direct' && error.includes('CORS')) {
      return 'Direct connection not available due to CORS restrictions (this is expected in browser environments)';
    }
    
    return error;
  }

  /**
   * Calculate overall health based on connection and authentication state
   */
  private calculateOverallHealth(
    proxyResult: any, 
    directResult: any, 
    isAuthenticated: boolean, 
    hasValidToken: boolean
  ): string {
    const hasConnection = proxyResult?.success || directResult?.success;
    
    if (isAuthenticated && hasValidToken && hasConnection) {
      return 'Excellent';
    } else if (isAuthenticated && hasConnection) {
      return 'Good';
    } else if (hasConnection) {
      return 'Fair';
    } else {
      return 'Poor';
    }
  }

  /**
   * Assess production readiness based on multiple factors
   */
  private assessProductionReadiness(
    proxyResult: any, 
    isAuthenticated: boolean, 
    hasValidToken: boolean
  ): string {
    if (!proxyResult?.success) {
      return 'Not Ready - No connection available';
    }
    
    if (!isAuthenticated || !hasValidToken) {
      return 'Needs Authentication - Connection available but not authenticated';
    }
    
    if (proxyResult.responseTime > 5000) {
      return 'Needs Optimization - Slow response times detected';
    }
    
    if (proxyResult.responseTime > 3000) {
      return 'Ready with Caution - Acceptable but could be faster';
    }
    
    return 'Production Ready';
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(): any {
    return gps51IntelligentConnectionManager.getConnectionHealth();
  }
}