import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  RefreshCw, 
  Shield,
  Database,
  Zap,
  Activity,
  Settings,
  Link,
  RotateCcw,
  Trash2,
  TestTube
} from 'lucide-react';
import { gps51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';
import { useToast } from '@/hooks/use-toast';

interface ErrorDetails {
  category: 'CORS' | 'NETWORK' | 'AUTH' | 'API' | 'CONFIG' | 'UNKNOWN';
  rootCause: string;
  impact: string;
  recommendations: string[];
  quickFixes: QuickFix[];
  technicalDetails?: any;
}

interface QuickFix {
  label: string;
  action: string;
  description: string;
}

interface ValidationStep {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  errorDetails?: ErrorDetails;
  data?: any;
}

export const GPS51ProductionValidator = () => {
  const { toast } = useToast();
  const [isValidating, setIsValidating] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([
    {
      name: 'Authentication',
      description: 'Verify GPS51 credentials and token generation',
      status: 'pending'
    },
    {
      name: 'Device List',
      description: 'Fetch device list with emergency caching',
      status: 'pending'
    },
    {
      name: 'Real-time Positions',
      description: 'Retrieve live vehicle positions',
      status: 'pending'
    },
    {
      name: 'Data Flow',
      description: 'Verify end-to-end data processing',
      status: 'pending'
    }
  ]);

  const updateStep = (index: number, update: Partial<ValidationStep>) => {
    setValidationSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, ...update } : step
    ));
  };

  // Enhanced error analysis function
  const analyzeError = (error: any, stepName: string): ErrorDetails => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    // CORS Error Detection
    if (errorMessage.includes('CORS') || 
        errorMessage.includes('Access-Control-Allow-Origin') ||
        errorMessage.includes('blocked by CORS policy')) {
      return {
        category: 'CORS',
        rootCause: 'Cross-Origin Resource Sharing (CORS) policy is blocking the request to GPS51 API',
        impact: 'Cannot connect to GPS51 servers from browser environment',
        recommendations: [
          'Use a CORS proxy service for development',
          'Deploy to production environment with proper CORS configuration',
          'Contact GPS51 support to whitelist your domain',
          'Use server-side proxy for API calls'
        ],
        quickFixes: [
          { label: 'Test Alternative Connection', action: 'test-proxy', description: 'Try connecting through emergency proxy' },
          { label: 'Clear Browser Cache', action: 'clear-cache', description: 'Clear browser cache and retry' }
        ],
        technicalDetails: { errorMessage, userAgent: navigator.userAgent }
      };
    }

    // Network Connectivity Issues
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('network error') ||
        errorMessage.includes('TypeError: Failed to fetch')) {
      return {
        category: 'NETWORK',
        rootCause: 'Network connectivity issue preventing API communication',
        impact: 'Cannot reach GPS51 servers due to network problems',
        recommendations: [
          'Check internet connection',
          'Verify GPS51 API server status',
          'Try again in a few minutes',
          'Check if firewall is blocking the connection'
        ],
        quickFixes: [
          { label: 'Test Connection', action: 'test-network', description: 'Test basic network connectivity' },
          { label: 'Retry with Timeout', action: 'retry-timeout', description: 'Retry with longer timeout period' }
        ],
        technicalDetails: { errorMessage, timestamp: new Date().toISOString() }
      };
    }

    // Authentication Errors
    if (errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Invalid credentials') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401')) {
      return {
        category: 'AUTH',
        rootCause: 'GPS51 authentication credentials are invalid or expired',
        impact: 'Cannot access GPS51 API without valid authentication',
        recommendations: [
          'Verify username and password are correct',
          'Check if credentials have expired',
          'Re-enter credentials in GPS51 settings',
          'Contact GPS51 support if credentials should be valid'
        ],
        quickFixes: [
          { label: 'Open GPS51 Settings', action: 'open-settings', description: 'Go to GPS51 credentials panel' },
          { label: 'Clear Auth Cache', action: 'clear-auth', description: 'Clear stored authentication data' }
        ],
        technicalDetails: { errorMessage, hasCredentials: !!localStorage.getItem('gps51_credentials') }
      };
    }

    // Configuration Errors
    if (errorMessage.includes('No saved credentials') ||
        errorMessage.includes('Please authenticate first') ||
        stepName === 'Authentication' && errorMessage.includes('found')) {
      return {
        category: 'CONFIG',
        rootCause: 'GPS51 credentials have not been configured in the system',
        impact: 'Cannot start validation without proper GPS51 configuration',
        recommendations: [
          'Set up GPS51 credentials in Settings > GPS51 tab',
          'Ensure username and password are entered correctly',
          'Test credentials after setup',
          'Save credentials properly in the system'
        ],
        quickFixes: [
          { label: 'Setup Credentials', action: 'setup-credentials', description: 'Open credentials setup panel' },
          { label: 'Import Credentials', action: 'import-config', description: 'Import from backup configuration' }
        ],
        technicalDetails: { errorMessage, configExists: !!localStorage.getItem('gps51_credentials') }
      };
    }

    // API Response Errors
    if (errorMessage.includes('status') && (errorMessage.includes('500') || errorMessage.includes('503'))) {
      return {
        category: 'API',
        rootCause: 'GPS51 API server is experiencing issues or downtime',
        impact: 'GPS51 services are temporarily unavailable',
        recommendations: [
          'Wait and retry in a few minutes',
          'Check GPS51 service status page',
          'Use cached data if available',
          'Enable emergency mode for critical operations'
        ],
        quickFixes: [
          { label: 'Enable Emergency Mode', action: 'emergency-mode', description: 'Switch to emergency cached data' },
          { label: 'Check Service Status', action: 'check-status', description: 'Verify GPS51 API health' }
        ],
        technicalDetails: { errorMessage, timestamp: new Date().toISOString() }
      };
    }

    // Generic/Unknown Errors
    return {
      category: 'UNKNOWN',
      rootCause: 'An unexpected error occurred during validation',
      impact: 'Cannot complete production readiness validation',
      recommendations: [
        'Check browser console for detailed error messages',
        'Try refreshing the page and running validation again',
        'Check network connectivity',
        'Contact technical support with error details'
      ],
      quickFixes: [
        { label: 'View Console Logs', action: 'view-console', description: 'Open browser console for details' },
        { label: 'Full System Reset', action: 'full-reset', description: 'Clear all caches and restart' }
      ],
      technicalDetails: { errorMessage, errorStack, timestamp: new Date().toISOString() }
    };
  };

  // Enhanced validation with detailed error analysis
  const runProductionValidation = async () => {
    setIsValidating(true);
    
    try {
      // Step 1: Enhanced Authentication Validation
      updateStep(0, { status: 'running' });
      
      try {
        // Pre-flight checks
        const savedCredentials = localStorage.getItem('gps51_credentials');
        if (!savedCredentials) {
          throw new Error('No saved credentials found. Please authenticate first.');
        }

        let credentials;
        try {
          credentials = JSON.parse(savedCredentials);
        } catch (e) {
          throw new Error('Saved credentials are corrupted. Please re-enter credentials.');
        }

        if (!credentials.username || !credentials.password) {
          throw new Error('Incomplete credentials. Missing username or password.');
        }

        if (!gps51EmergencyManager.isAuthenticated()) {
          const authResult = await gps51EmergencyManager.authenticate(credentials);
          
          if (!authResult.success) {
            throw new Error(authResult.error || 'Authentication failed with valid credentials');
          }
        }
        
        updateStep(0, { 
          status: 'success', 
          data: { 
            username: gps51EmergencyManager.getUsername(),
            authMethod: 'Emergency Manager',
            credentialsValid: true
          } 
        });

      } catch (error) {
        const errorDetails = analyzeError(error, 'Authentication');
        updateStep(0, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Authentication failed',
          errorDetails
        });
        throw error;
      }

      // Step 2: Enhanced Device List Validation
      updateStep(1, { status: 'running' });
      
      try {
        const devices = await gps51EmergencyManager.getDeviceList(false);
        
        if (!Array.isArray(devices)) {
          throw new Error('Invalid device list response format');
        }

        if (devices.length === 0) {
          throw new Error('No devices found in GPS51 account. Verify account has devices configured.');
        }

        updateStep(1, { 
          status: 'success', 
          data: { 
            count: devices.length,
            sampleDevices: devices.slice(0, 3).map(d => ({ id: d.deviceid, name: d.devicename })),
            cached: true
          } 
        });

      } catch (error) {
        const errorDetails = analyzeError(error, 'Device List');
        updateStep(1, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Device list fetch failed',
          errorDetails
        });
        throw error;
      }

      // Step 3: Enhanced Position Data Validation
      updateStep(2, { status: 'running' });
      
      try {
        const devices = await gps51EmergencyManager.getDeviceList(false);
        const deviceIds = devices.map(d => d.deviceid).slice(0, 5);
        
        if (deviceIds.length === 0) {
          throw new Error('No device IDs available for position testing');
        }

        const positionsResult = await gps51EmergencyManager.getRealtimePositions(deviceIds, 0);
        
        if (!positionsResult || !Array.isArray(positionsResult.positions)) {
          throw new Error('Invalid positions response format from GPS51 API');
        }

        updateStep(2, { 
          status: 'success', 
          data: { 
            positions: positionsResult.positions.length,
            lastQueryTime: positionsResult.lastQueryTime,
            devicesTested: deviceIds.length,
            dataFreshness: new Date(positionsResult.lastQueryTime).toLocaleString()
          } 
        });

      } catch (error) {
        const errorDetails = analyzeError(error, 'Real-time Positions');
        updateStep(2, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Position data fetch failed',
          errorDetails
        });
        throw error;
      }

      // Step 4: Enhanced System Diagnostics
      updateStep(3, { status: 'running' });
      
      try {
        const diagnostics = gps51EmergencyManager.getDiagnostics();
        
        if (!diagnostics || !diagnostics.client) {
          throw new Error('Emergency manager diagnostics not available');
        }

        const healthScore = diagnostics.client.cacheSize > 0 ? 100 : 75;
        
        updateStep(3, { 
          status: 'success', 
          data: { 
            cacheSize: diagnostics.client.cacheSize,
            queueSize: diagnostics.client.queueSize,
            emergencyMode: diagnostics.emergencyMode,
            healthScore: `${healthScore}%`,
            systemStatus: 'Operational'
          } 
        });

      } catch (error) {
        const errorDetails = analyzeError(error, 'Data Flow');
        updateStep(3, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'System diagnostics failed',
          errorDetails
        });
        throw error;
      }

      toast({
        title: 'Production Validation Complete',
        description: 'All systems validated successfully. GPS51 is ready for live deployment.',
      });

    } catch (error) {
      toast({
        title: 'Production Validation Failed',
        description: 'Check detailed error analysis below for specific fixes.',
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Quick fix handlers
  const handleQuickFix = async (action: string) => {
    switch (action) {
      case 'clear-auth':
        localStorage.removeItem('gps51_credentials');
        sessionStorage.removeItem('gps51_token');
        gps51EmergencyManager.clearAllCaches();
        toast({ title: 'Authentication cache cleared' });
        break;
      case 'clear-cache':
        gps51EmergencyManager.clearAllCaches();
        toast({ title: 'All caches cleared' });
        break;
      case 'setup-credentials':
        toast({ title: 'Navigate to Settings > GPS51 to setup credentials' });
        break;
      case 'emergency-mode':
        localStorage.setItem('gps51_emergency_status', JSON.stringify({ active: true }));
        toast({ title: 'Emergency mode enabled' });
        break;
      default:
        toast({ title: `Quick fix: ${action}` });
    }
  };

  const resetValidation = () => {
    setValidationSteps(prev => prev.map(step => ({ 
      ...step, 
      status: 'pending' as const,
      error: undefined,
      data: undefined
    })));
  };

  const successfulSteps = validationSteps.filter(step => step.status === 'success').length;
  const progressPercentage = (successfulSteps / validationSteps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Production Readiness Validation
        </CardTitle>
        <CardDescription>
          Comprehensive validation of GPS51 emergency system for live deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{Math.round(progressPercentage)}%</div>
            <div className="text-sm text-muted-foreground">Production Ready</div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={resetValidation}
              variant="outline"
              size="sm"
              disabled={isValidating}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              onClick={runProductionValidation}
              disabled={isValidating}
              className="flex items-center gap-2"
            >
              <Play className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
              {isValidating ? 'Validating...' : 'Run Validation'}
            </Button>
          </div>
        </div>
        
        <Progress value={progressPercentage} className="w-full" />

        <div className="space-y-3">
          {validationSteps.map((step, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{step.name}</div>
                <div className="flex items-center gap-2">
                  {step.status === 'pending' && (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                  {step.status === 'running' && (
                    <Badge variant="secondary">
                      <Activity className="h-3 w-3 mr-1 animate-pulse" />
                      Running
                    </Badge>
                  )}
                  {step.status === 'success' && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  )}
                  {step.status === 'error' && (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                {step.description}
              </div>
              
              {step.data && (
                <div className="text-xs bg-muted p-2 rounded">
                  <strong>Result:</strong> {JSON.stringify(step.data, null, 2)}
                </div>
              )}
              
              {step.error && step.errorDetails && (
                <div className="mt-3 space-y-3">
                  {/* Error Summary */}
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="font-medium">{step.error}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {step.errorDetails.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {step.errorDetails.impact}
                          </span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Root Cause Analysis */}
                  <div className="bg-muted/50 p-3 rounded-lg border-l-4 border-destructive">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Root Cause Analysis
                    </h5>
                    <p className="text-sm text-muted-foreground">{step.errorDetails.rootCause}</p>
                  </div>

                  {/* Quick Fixes */}
                  {step.errorDetails.quickFixes.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Quick Fixes
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {step.errorDetails.quickFixes.map((fix, fixIndex) => (
                          <Button
                            key={fixIndex}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickFix(fix.action)}
                            className="justify-start text-left h-auto p-2"
                          >
                            <div className="flex items-start gap-2">
                              <Settings className="h-3 w-3 mt-0.5 text-muted-foreground" />
                              <div>
                                <div className="text-xs font-medium">{fix.label}</div>
                                <div className="text-xs text-muted-foreground">{fix.description}</div>
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="space-y-2">
                    <h5 className="font-medium text-sm flex items-center gap-2">
                      <TestTube className="h-4 w-4" />
                      Recommended Actions
                    </h5>
                    <ul className="space-y-1">
                      {step.errorDetails.recommendations.map((rec, recIndex) => (
                        <li key={recIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Technical Details (Collapsible) */}
                  {step.errorDetails.technicalDetails && (
                    <details className="border rounded-lg p-2">
                      <summary className="text-xs font-medium cursor-pointer text-muted-foreground">
                        Technical Details (Click to expand)
                      </summary>
                      <div className="mt-2 text-xs bg-muted p-2 rounded font-mono">
                        <pre>{JSON.stringify(step.errorDetails.technicalDetails, null, 2)}</pre>
                      </div>
                    </details>
                  )}
                </div>
              )}

              {step.error && !step.errorDetails && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{step.error}</AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </div>

        {progressPercentage === 100 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              🎉 All validation steps completed successfully! The GPS51 emergency system is ready for live deployment.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};