import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';

/**
 * Handles GPS51 connection testing with production-grade diagnostics
 */
export class GPS51ConnectionTester {
  /**
   * Test connection using unified service with production-grade diagnostics
   */
  async testConnection(apiUrl?: string): Promise<{
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

      // Enhanced health analysis
      const enhancedHealthStatus = {
        ...baseHealthStatus,
        connectionTests: {
          proxy: {
            success: proxyResult?.success || false,
            responseTime: proxyResult?.responseTime || 0,
            error: proxyResult?.error
          },
          direct: {
            success: directResult?.success || false,
            responseTime: directResult?.responseTime || 0,
            error: directResult?.error
          }
        },
        overallHealth: (proxyResult?.success || directResult?.success) ? 'Good' : 'Poor',
        recommendedStrategy: proxyResult?.success ? 'proxy' : directResult?.success ? 'direct' : 'troubleshooting_needed',
        productionReadiness: (proxyResult?.success && proxyResult.responseTime < 3000) ? 'Ready' : 'Needs Optimization'
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
   * Get connection health status
   */
  getConnectionHealth(): any {
    return gps51IntelligentConnectionManager.getConnectionHealth();
  }
}