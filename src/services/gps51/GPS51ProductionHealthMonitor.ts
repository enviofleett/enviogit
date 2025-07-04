import { gps51UnifiedAuthService } from './GPS51UnifiedAuthService';
import { gps51StartupService } from './GPS51StartupService';

/**
 * Production-grade health monitoring service for GPS51 integration
 */
export class GPS51ProductionHealthMonitor {
  private static instance: GPS51ProductionHealthMonitor;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private lastHealthReport: any = null;

  static getInstance(): GPS51ProductionHealthMonitor {
    if (!GPS51ProductionHealthMonitor.instance) {
      GPS51ProductionHealthMonitor.instance = new GPS51ProductionHealthMonitor();
    }
    return GPS51ProductionHealthMonitor.instance;
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(intervalMs = 30000): void {
    if (this.isMonitoring) {
      console.log('GPS51ProductionHealthMonitor: Already monitoring');
      return;
    }

    console.log('GPS51ProductionHealthMonitor: Starting production health monitoring...');
    this.isMonitoring = true;

    // Immediate health check
    this.performHealthCheck();

    // Schedule regular health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.isMonitoring = false;
    console.log('GPS51ProductionHealthMonitor: Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<any> {
    try {
      console.log('GPS51ProductionHealthMonitor: Performing health check...');

      const startTime = Date.now();

      // Check authentication status
      const authStatus = gps51UnifiedAuthService.getAuthenticationStatus();
      
      // Check connection health
      const connectionTest = await gps51UnifiedAuthService.testConnection();
      
      // Check startup service status
      const startupStatus = gps51StartupService.getInitializationStatus();
      
      // Perform live data test if authenticated
      let liveDataTest = null;
      if (authStatus.isAuthenticated) {
        try {
          const liveDataManager = gps51StartupService.getLiveDataManager();
          const quickSync = await liveDataManager.forceLiveDataSync();
          liveDataTest = {
            success: true,
            deviceCount: quickSync.devices.length,
            positionCount: quickSync.positions.length,
            lastUpdate: quickSync.lastUpdate
          };
        } catch (error) {
          liveDataTest = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      const healthDuration = Date.now() - startTime;

      // Compile comprehensive health report
      const healthReport = {
        timestamp: new Date().toISOString(),
        overallStatus: this.calculateOverallStatus(authStatus, connectionTest, liveDataTest),
        productionReadiness: this.assessProductionReadiness(authStatus, connectionTest, liveDataTest),
        components: {
          authentication: {
            status: authStatus.isAuthenticated ? 'Operational' : 'Failed',
            hasToken: authStatus.hasToken,
            user: authStatus.user?.username || 'None'
          },
          connectivity: {
            status: connectionTest.success ? 'Operational' : 'Failed',
            responseTime: connectionTest.responseTime,
            error: connectionTest.error,
            healthStatus: connectionTest.healthStatus
          },
          startup: {
            status: startupStatus.productionReady ? 'Ready' : 'Not Ready',
            initialized: startupStatus.initialized,
            authenticated: startupStatus.authenticated,
            liveDataActive: startupStatus.liveDataActive
          },
          liveData: liveDataTest ? {
            status: liveDataTest.success ? 'Operational' : 'Failed',
            deviceCount: liveDataTest.deviceCount,
            positionCount: liveDataTest.positionCount,
            error: liveDataTest.error
          } : {
            status: 'Not Tested',
            reason: 'Authentication required'
          }
        },
        performance: {
          healthCheckDuration: healthDuration,
          connectionResponseTime: connectionTest.responseTime,
          performanceRating: this.ratePerformance(connectionTest.responseTime, healthDuration)
        },
        recommendations: this.generateRecommendations(authStatus, connectionTest, liveDataTest)
      };

      this.lastHealthReport = healthReport;

      // Log summary
      console.log('GPS51ProductionHealthMonitor: Health check completed:', {
        overallStatus: healthReport.overallStatus,
        productionReadiness: healthReport.productionReadiness,
        authStatus: healthReport.components.authentication.status,
        connectivityStatus: healthReport.components.connectivity.status,
        liveDataStatus: healthReport.components.liveData.status,
        performanceRating: healthReport.performance.performanceRating
      });

      // Dispatch health update event
      window.dispatchEvent(new CustomEvent('gps51-health-update', {
        detail: healthReport
      }));

      return healthReport;
    } catch (error) {
      console.error('GPS51ProductionHealthMonitor: Health check failed:', error);
      
      const errorReport = {
        timestamp: new Date().toISOString(),
        overallStatus: 'Error',
        productionReadiness: 'Not Ready',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.lastHealthReport = errorReport;
      return errorReport;
    }
  }

  /**
   * Calculate overall system status
   */
  private calculateOverallStatus(authStatus: any, connectionTest: any, liveDataTest: any): string {
    if (!authStatus.isAuthenticated) return 'Authentication Failed';
    if (!connectionTest.success) return 'Connection Failed';
    if (liveDataTest && !liveDataTest.success) return 'Live Data Failed';
    
    return 'Operational';
  }

  /**
   * Assess production readiness
   */
  private assessProductionReadiness(authStatus: any, connectionTest: any, liveDataTest: any): string {
    const issues = [];
    
    if (!authStatus.isAuthenticated) issues.push('Authentication');
    if (!connectionTest.success) issues.push('Connectivity');
    if (connectionTest.responseTime > 3000) issues.push('Performance');
    if (liveDataTest && !liveDataTest.success) issues.push('Live Data');
    
    if (issues.length === 0) return '100% Ready';
    if (issues.length === 1) return 'Ready with Warnings';
    return 'Not Ready';
  }

  /**
   * Rate system performance
   */
  private ratePerformance(connectionTime: number, healthCheckTime: number): string {
    const avgTime = (connectionTime + healthCheckTime) / 2;
    
    if (avgTime < 1000) return 'Excellent';
    if (avgTime < 2000) return 'Good';
    if (avgTime < 5000) return 'Fair';
    return 'Poor';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(authStatus: any, connectionTest: any, liveDataTest: any): string[] {
    const recommendations = [];
    
    if (!authStatus.isAuthenticated) {
      recommendations.push('✅ Configure GPS51 credentials in Settings → Credentials tab');
    }
    
    if (!connectionTest.success) {
      recommendations.push('🔧 Check network connectivity and Edge Function deployment');
    }
    
    if (connectionTest.responseTime > 3000) {
      recommendations.push('⚡ Consider optimizing connection performance');
    }
    
    if (liveDataTest && !liveDataTest.success) {
      recommendations.push('📡 Check device connectivity and API parameters');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('🎉 All systems operational - production ready!');
    }
    
    return recommendations;
  }

  /**
   * Get latest health report
   */
  getLatestHealthReport(): any {
    return this.lastHealthReport;
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

export const gps51ProductionHealthMonitor = GPS51ProductionHealthMonitor.getInstance();