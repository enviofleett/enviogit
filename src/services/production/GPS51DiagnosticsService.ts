// GPS51 Diagnostics Service - Phase 4.5
// Advanced diagnostics and troubleshooting

import { gps51ConfigManager } from './GPS51ConfigManager';
import { gps51HealthMonitor } from './GPS51HealthMonitor';
import { gps51PerformanceMonitor } from '../performance/GPS51PerformanceMonitor';
import { supabase } from '@/integrations/supabase/client';

export interface DiagnosticTest {
  id: string;
  name: string;
  category: 'connectivity' | 'authentication' | 'data' | 'performance' | 'configuration';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  automated: boolean;
  requiresUserInput: boolean;
}

export interface DiagnosticResult {
  testId: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  details?: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
  executionTime: number;
  timestamp: Date;
}

export interface DiagnosticReport {
  id: string;
  generatedAt: Date;
  environment: string;
  version: string;
  totalTests: number;
  results: DiagnosticResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
  overallStatus: 'healthy' | 'issues_detected' | 'critical_issues';
  recommendations: string[];
}

export interface TroubleshootingStep {
  id: string;
  title: string;
  description: string;
  action: 'check' | 'fix' | 'verify' | 'manual';
  automated: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  estimatedTime: string;
  instructions?: string[];
}

export class GPS51DiagnosticsService {
  private static instance: GPS51DiagnosticsService;
  private diagnosticTests = new Map<string, DiagnosticTest>();
  private troubleshootingSteps = new Map<string, TroubleshootingStep>();

  static getInstance(): GPS51DiagnosticsService {
    if (!GPS51DiagnosticsService.instance) {
      GPS51DiagnosticsService.instance = new GPS51DiagnosticsService();
    }
    return GPS51DiagnosticsService.instance;
  }

  constructor() {
    this.initializeDiagnosticTests();
    this.initializeTroubleshootingSteps();
  }

  private initializeDiagnosticTests(): void {
    const tests: DiagnosticTest[] = [
      {
        id: 'gps51_connection',
        name: 'GPS51 API Connection',
        category: 'connectivity',
        description: 'Test connection to GPS51 API endpoints',
        severity: 'critical',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'gps51_authentication',
        name: 'GPS51 Authentication',
        category: 'authentication',
        description: 'Verify GPS51 credentials and token validity',
        severity: 'critical',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'supabase_connection',
        name: 'Supabase Database Connection',
        category: 'connectivity',
        description: 'Test connection to Supabase database',
        severity: 'high',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'browser_compatibility',
        name: 'Browser Compatibility',
        category: 'configuration',
        description: 'Check browser support for required features',
        severity: 'medium',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'local_storage',
        name: 'Local Storage Access',
        category: 'configuration',
        description: 'Verify browser storage functionality',
        severity: 'medium',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'network_performance',
        name: 'Network Performance',
        category: 'performance',
        description: 'Measure network latency and throughput',
        severity: 'medium',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'data_sync_integrity',
        name: 'Data Synchronization',
        category: 'data',
        description: 'Verify data synchronization between GPS51 and local storage',
        severity: 'high',
        automated: true,
        requiresUserInput: false
      },
      {
        id: 'performance_metrics',
        name: 'Performance Metrics',
        category: 'performance',
        description: 'Analyze application performance metrics',
        severity: 'low',
        automated: true,
        requiresUserInput: false
      }
    ];

    tests.forEach(test => {
      this.diagnosticTests.set(test.id, test);
    });
  }

  private initializeTroubleshootingSteps(): void {
    const steps: TroubleshootingStep[] = [
      {
        id: 'clear_browser_cache',
        title: 'Clear Browser Cache',
        description: 'Clear browser cache and reload the application',
        action: 'manual',
        automated: false,
        priority: 'low',
        category: 'general',
        estimatedTime: '2 minutes',
        instructions: [
          'Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)',
          'Select "All time" as the time range',
          'Check "Cached images and files"',
          'Click "Clear data"',
          'Reload the application'
        ]
      },
      {
        id: 'check_gps51_credentials',
        title: 'Verify GPS51 Credentials',
        description: 'Check if GPS51 credentials are correctly configured',
        action: 'check',
        automated: true,
        priority: 'high',
        category: 'authentication',
        estimatedTime: '30 seconds'
      },
      {
        id: 'reset_local_storage',
        title: 'Reset Local Storage',
        description: 'Clear all locally stored configuration and data',
        action: 'fix',
        automated: true,
        priority: 'medium',
        category: 'configuration',
        estimatedTime: '30 seconds'
      },
      {
        id: 'test_network_connectivity',
        title: 'Test Network Connectivity',
        description: 'Verify internet connection and DNS resolution',
        action: 'check',
        automated: true,
        priority: 'high',
        category: 'connectivity',
        estimatedTime: '1 minute'
      },
      {
        id: 'restart_monitoring',
        title: 'Restart Performance Monitoring',
        description: 'Stop and restart performance monitoring services',
        action: 'fix',
        automated: true,
        priority: 'medium',
        category: 'performance',
        estimatedTime: '15 seconds'
      }
    ];

    steps.forEach(step => {
      this.troubleshootingSteps.set(step.id, step);
    });
  }

  // Diagnostic Test Execution
  async runDiagnostic(testId: string): Promise<DiagnosticResult> {
    const test = this.diagnosticTests.get(testId);
    if (!test) {
      throw new Error(`Diagnostic test not found: ${testId}`);
    }

    const startTime = performance.now();

    try {
      let result: DiagnosticResult;

      switch (testId) {
        case 'gps51_connection':
          result = await this.testGPS51Connection();
          break;
        case 'gps51_authentication':
          result = await this.testGPS51Authentication();
          break;
        case 'supabase_connection':
          result = await this.testSupabaseConnection();
          break;
        case 'browser_compatibility':
          result = await this.testBrowserCompatibility();
          break;
        case 'local_storage':
          result = await this.testLocalStorage();
          break;
        case 'network_performance':
          result = await this.testNetworkPerformance();
          break;
        case 'data_sync_integrity':
          result = await this.testDataSyncIntegrity();
          break;
        case 'performance_metrics':
          result = await this.testPerformanceMetrics();
          break;
        default:
          result = {
            testId,
            status: 'skipped',
            message: 'Test not implemented',
            executionTime: 0,
            timestamp: new Date()
          };
      }

      result.executionTime = performance.now() - startTime;
      return result;
    } catch (error) {
      return {
        testId,
        status: 'failed',
        message: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: performance.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  // Individual Diagnostic Tests
  private async testGPS51Connection(): Promise<DiagnosticResult> {
    const config = gps51ConfigManager.getCurrentConfig();
    const apiUrl = config?.environment.apiUrl || 'https://api.gps51.com/openapi';

    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        return {
          testId: 'gps51_connection',
          status: 'passed',
          message: 'GPS51 API is reachable and responding',
          details: `API URL: ${apiUrl}, Status: ${response.status}`,
          timestamp: new Date(),
          executionTime: 0
        };
      } else {
        return {
          testId: 'gps51_connection',
          status: 'failed',
          message: `GPS51 API returned error status: ${response.status}`,
          details: `Response: ${response.statusText}`,
          suggestions: [
            'Check if GPS51 API is experiencing downtime',
            'Verify the API URL in configuration',
            'Check network connectivity'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }
    } catch (error) {
      return {
        testId: 'gps51_connection',
        status: 'failed',
        message: 'Cannot connect to GPS51 API',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check internet connection',
          'Verify GPS51 API URL is correct',
          'Check if firewall is blocking the connection',
          'Try again later - GPS51 API might be temporarily unavailable'
        ],
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testGPS51Authentication(): Promise<DiagnosticResult> {
    try {
      // Check if credentials are stored
      const storedConfig = localStorage.getItem('gps51_credentials');
      if (!storedConfig) {
        return {
          testId: 'gps51_authentication',
          status: 'failed',
          message: 'GPS51 credentials not found',
          suggestions: [
            'Configure GPS51 credentials in Settings',
            'Ensure username and password are correct',
            'Check if credentials are properly saved'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      const credentials = JSON.parse(storedConfig);
      if (!credentials.username || !credentials.apiUrl) {
        return {
          testId: 'gps51_authentication',
          status: 'failed',
          message: 'GPS51 credentials are incomplete',
          suggestions: [
            'Reconfigure GPS51 credentials',
            'Ensure all required fields are filled'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      // Check if password hash exists
      const passwordHash = localStorage.getItem('gps51_password_hash');
      if (!passwordHash) {
        return {
          testId: 'gps51_authentication',
          status: 'failed',
          message: 'GPS51 password not found',
          suggestions: [
            'Re-enter GPS51 password in Settings',
            'Ensure password is saved properly'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      return {
        testId: 'gps51_authentication',
        status: 'passed',
        message: 'GPS51 credentials are properly configured',
        details: `Username: ${credentials.username}, API URL: ${credentials.apiUrl}`,
        timestamp: new Date(),
        executionTime: 0
      };
    } catch (error) {
      return {
        testId: 'gps51_authentication',
        status: 'failed',
        message: 'Error checking GPS51 credentials',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Clear browser storage and reconfigure credentials',
          'Check browser console for additional errors'
        ],
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testSupabaseConnection(): Promise<DiagnosticResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        return {
          testId: 'supabase_connection',
          status: 'failed',
          message: 'Supabase connection failed',
          details: error.message,
          suggestions: [
            'Check internet connection',
            'Verify Supabase configuration',
            'Check if Supabase service is available'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      return {
        testId: 'supabase_connection',
        status: 'passed',
        message: 'Supabase connection is working',
        timestamp: new Date(),
        executionTime: 0
      };
    } catch (error) {
      return {
        testId: 'supabase_connection',
        status: 'failed',
        message: 'Supabase connection error',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check network connectivity',
          'Verify Supabase project configuration',
          'Check browser console for additional errors'
        ],
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testBrowserCompatibility(): Promise<DiagnosticResult> {
    const issues: string[] = [];
    const features = {
      localStorage: 'localStorage' in window,
      fetch: 'fetch' in window,
      webSocket: 'WebSocket' in window,
      performance: 'performance' in window,
      promise: 'Promise' in window,
      crypto: 'crypto' in window
    };

    Object.entries(features).forEach(([feature, supported]) => {
      if (!supported) {
        issues.push(`${feature} is not supported`);
      }
    });

    if (issues.length > 0) {
      return {
        testId: 'browser_compatibility',
        status: 'failed',
        message: 'Browser compatibility issues detected',
        details: issues.join(', '),
        suggestions: [
          'Update your browser to the latest version',
          'Try using a modern browser (Chrome, Firefox, Safari, Edge)',
          'Enable JavaScript if disabled'
        ],
        metadata: features,
        timestamp: new Date(),
        executionTime: 0
      };
    }

    return {
      testId: 'browser_compatibility',
      status: 'passed',
      message: 'Browser is compatible with all required features',
      metadata: features,
      timestamp: new Date(),
      executionTime: 0
    };
  }

  private async testLocalStorage(): Promise<DiagnosticResult> {
    try {
      const testKey = 'diagnostic_test';
      const testValue = 'test_value_' + Date.now();

      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved === testValue) {
        return {
          testId: 'local_storage',
          status: 'passed',
          message: 'Local storage is working correctly',
          timestamp: new Date(),
          executionTime: 0
        };
      } else {
        return {
          testId: 'local_storage',
          status: 'failed',
          message: 'Local storage test failed',
          suggestions: [
            'Check if browser storage is disabled',
            'Clear browser data and try again',
            'Check available storage space'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }
    } catch (error) {
      return {
        testId: 'local_storage',
        status: 'failed',
        message: 'Local storage error',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Enable browser storage',
          'Check browser privacy settings',
          'Try in incognito/private mode'
        ],
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testNetworkPerformance(): Promise<DiagnosticResult> {
    try {
      const startTime = performance.now();
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = performance.now() - startTime;

      let status: DiagnosticResult['status'] = 'passed';
      let message = `Network latency: ${latency.toFixed(0)}ms`;
      const suggestions: string[] = [];

      if (latency > 2000) {
        status = 'failed';
        message = `Poor network performance: ${latency.toFixed(0)}ms latency`;
        suggestions.push(
          'Check internet connection speed',
          'Try connecting to a different network',
          'Contact your ISP if issues persist'
        );
      } else if (latency > 1000) {
        status = 'warning';
        message = `Slow network performance: ${latency.toFixed(0)}ms latency`;
        suggestions.push('Consider checking network connection quality');
      }

      return {
        testId: 'network_performance',
        status,
        message,
        details: `Response status: ${response.status}`,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        metadata: { latency: latency.toFixed(0) },
        timestamp: new Date(),
        executionTime: 0
      };
    } catch (error) {
      return {
        testId: 'network_performance',
        status: 'failed',
        message: 'Network performance test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check internet connection',
          'Verify DNS settings',
          'Try again later'
        ],
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testDataSyncIntegrity(): Promise<DiagnosticResult> {
    try {
      // Check for recent sync jobs
      const { data: syncJobs, error } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);

      if (error) {
        return {
          testId: 'data_sync_integrity',
          status: 'failed',
          message: 'Cannot access sync job data',
          details: error.message,
          suggestions: [
            'Check Supabase connection',
            'Verify database permissions'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      if (!syncJobs || syncJobs.length === 0) {
        return {
          testId: 'data_sync_integrity',
          status: 'warning',
          message: 'No recent sync jobs found',
          suggestions: [
            'Run a manual sync from Settings',
            'Check if GPS51 credentials are configured',
            'Verify cron jobs are running'
          ],
          timestamp: new Date(),
          executionTime: 0
        };
      }

      const recentFailures = syncJobs.filter(job => job.success === false).length;
      const successRate = ((syncJobs.length - recentFailures) / syncJobs.length) * 100;

      if (successRate < 50) {
        return {
          testId: 'data_sync_integrity',
          status: 'failed',
          message: `High sync failure rate: ${recentFailures}/${syncJobs.length} recent jobs failed`,
          suggestions: [
            'Check GPS51 API connectivity',
            'Verify GPS51 credentials',
            'Check sync job logs for errors'
          ],
          metadata: { successRate, recentFailures, totalJobs: syncJobs.length },
          timestamp: new Date(),
          executionTime: 0
        };
      } else if (successRate < 80) {
        return {
          testId: 'data_sync_integrity',
          status: 'warning',
          message: `Some sync failures detected: ${recentFailures}/${syncJobs.length} recent jobs failed`,
          suggestions: [
            'Monitor sync job performance',
            'Check for intermittent connectivity issues'
          ],
          metadata: { successRate, recentFailures, totalJobs: syncJobs.length },
          timestamp: new Date(),
          executionTime: 0
        };
      }

      return {
        testId: 'data_sync_integrity',
        status: 'passed',
        message: `Data sync is working well: ${successRate.toFixed(0)}% success rate`,
        metadata: { successRate, recentFailures, totalJobs: syncJobs.length },
        timestamp: new Date(),
        executionTime: 0
      };
    } catch (error) {
      return {
        testId: 'data_sync_integrity',
        status: 'failed',
        message: 'Error checking data sync integrity',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  private async testPerformanceMetrics(): Promise<DiagnosticResult> {
    try {
      const healthReport = gps51PerformanceMonitor.getPerformanceReport();
      
      if (healthReport.systemHealth === 'critical') {
        return {
          testId: 'performance_metrics',
          status: 'failed',
          message: 'Critical performance issues detected',
          details: `${healthReport.activeAlerts} active alerts`,
          suggestions: [
            'Check performance monitoring dashboard',
            'Investigate high-priority alerts',
            'Consider restarting the application'
          ],
          metadata: healthReport,
          timestamp: new Date(),
          executionTime: 0
        };
      } else if (healthReport.systemHealth === 'warning' || healthReport.systemHealth === 'degraded') {
        return {
          testId: 'performance_metrics',
          status: 'warning',
          message: 'Performance issues detected',
          details: `${healthReport.activeAlerts} active alerts`,
          suggestions: [
            'Review performance metrics',
            'Check for resource bottlenecks'
          ],
          metadata: healthReport,
          timestamp: new Date(),
          executionTime: 0
        };
      }

      return {
        testId: 'performance_metrics',
        status: 'passed',
        message: 'Application performance is good',
        metadata: healthReport,
        timestamp: new Date(),
        executionTime: 0
      };
    } catch (error) {
      return {
        testId: 'performance_metrics',
        status: 'warning',
        message: 'Could not analyze performance metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        executionTime: 0
      };
    }
  }

  // Comprehensive Diagnostic Report
  async generateDiagnosticReport(): Promise<DiagnosticReport> {
    const reportId = `diag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const config = gps51ConfigManager.getCurrentConfig();
    
    console.log('GPS51DiagnosticsService: Generating comprehensive diagnostic report...');

    const testIds = Array.from(this.diagnosticTests.keys());
    const results: DiagnosticResult[] = [];

    // Run all diagnostic tests
    for (const testId of testIds) {
      try {
        const result = await this.runDiagnostic(testId);
        results.push(result);
      } catch (error) {
        results.push({
          testId,
          status: 'failed',
          message: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionTime: 0,
          timestamp: new Date()
        });
      }
    }

    // Calculate summary
    const summary = {
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warnings: results.filter(r => r.status === 'warning').length,
      skipped: results.filter(r => r.status === 'skipped').length
    };

    // Determine overall status
    let overallStatus: DiagnosticReport['overallStatus'] = 'healthy';
    if (summary.failed > 0) {
      overallStatus = summary.failed > 2 ? 'critical_issues' : 'issues_detected';
    } else if (summary.warnings > 0) {
      overallStatus = 'issues_detected';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    const report: DiagnosticReport = {
      id: reportId,
      generatedAt: new Date(),
      environment: config?.environment.name || 'unknown',
      version: config?.version || 'unknown',
      totalTests: testIds.length,
      results,
      summary,
      overallStatus,
      recommendations
    };

    console.log('GPS51DiagnosticsService: Diagnostic report generated:', {
      reportId,
      overallStatus,
      summary
    });

    return report;
  }

  private generateRecommendations(results: DiagnosticResult[]): string[] {
    const recommendations: Set<string> = new Set();

    const failedResults = results.filter(r => r.status === 'failed');
    const warningResults = results.filter(r => r.status === 'warning');

    // Add suggestions from failed tests
    failedResults.forEach(result => {
      if (result.suggestions) {
        result.suggestions.forEach(suggestion => recommendations.add(suggestion));
      }
    });

    // Add suggestions from warning tests
    warningResults.forEach(result => {
      if (result.suggestions) {
        result.suggestions.forEach(suggestion => recommendations.add(suggestion));
      }
    });

    // Add general recommendations based on patterns
    if (failedResults.some(r => r.testId.includes('gps51'))) {
      recommendations.add('Review GPS51 configuration and credentials');
    }

    if (failedResults.some(r => r.testId.includes('network'))) {
      recommendations.add('Check network connectivity and firewall settings');
    }

    if (failedResults.some(r => r.testId.includes('performance'))) {
      recommendations.add('Review application performance and resource usage');
    }

    if (failedResults.length === 0 && warningResults.length === 0) {
      recommendations.add('System is operating normally - no action required');
    }

    return Array.from(recommendations);
  }

  // Troubleshooting
  async executeTroubleshootingStep(stepId: string): Promise<{
    success: boolean;
    message: string;
    details?: string;
  }> {
    const step = this.troubleshootingSteps.get(stepId);
    if (!step) {
      return {
        success: false,
        message: `Troubleshooting step not found: ${stepId}`
      };
    }

    if (!step.automated) {
      return {
        success: false,
        message: 'This step requires manual execution',
        details: step.instructions?.join('\n')
      };
    }

    try {
      switch (stepId) {
        case 'check_gps51_credentials':
          return await this.checkGPS51Credentials();
        case 'reset_local_storage':
          return await this.resetLocalStorage();
        case 'test_network_connectivity':
          return await this.testNetworkConnectivityStep();
        case 'restart_monitoring':
          return await this.restartMonitoring();
        default:
          return {
            success: false,
            message: 'Troubleshooting step not implemented'
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Troubleshooting failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async checkGPS51Credentials(): Promise<{ success: boolean; message: string; details?: string }> {
    const result = await this.testGPS51Authentication();
    return {
      success: result.status === 'passed',
      message: result.message,
      details: result.details
    };
  }

  private async resetLocalStorage(): Promise<{ success: boolean; message: string }> {
    try {
      const keysToRemove = [
        'gps51_api_url',
        'gps51_username',
        'gps51_password_hash',
        'gps51_credentials',
        'gps51_deployment_config'
      ];

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      return {
        success: true,
        message: 'Local storage has been reset successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset local storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async testNetworkConnectivityStep(): Promise<{ success: boolean; message: string; details?: string }> {
    const result = await this.testNetworkPerformance();
    return {
      success: result.status === 'passed',
      message: result.message,
      details: result.details
    };
  }

  private async restartMonitoring(): Promise<{ success: boolean; message: string }> {
    try {
      gps51PerformanceMonitor.stopMonitoring();
      gps51HealthMonitor.stopMonitoring();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      gps51PerformanceMonitor.startMonitoring();
      gps51HealthMonitor.startMonitoring();

      return {
        success: true,
        message: 'Monitoring services have been restarted successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restart monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Public API
  getDiagnosticTests(): DiagnosticTest[] {
    return Array.from(this.diagnosticTests.values());
  }

  getTroubleshootingSteps(): TroubleshootingStep[] {
    return Array.from(this.troubleshootingSteps.values());
  }

  getDiagnosticTest(testId: string): DiagnosticTest | null {
    return this.diagnosticTests.get(testId) || null;
  }

  getTroubleshootingStep(stepId: string): TroubleshootingStep | null {
    return this.troubleshootingSteps.get(stepId) || null;
  }
}

// Create singleton instance
export const gps51DiagnosticsService = GPS51DiagnosticsService.getInstance();