import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Settings, Zap } from 'lucide-react';
import { gps51AuthService } from '@/services/gp51/GPS51AuthService';
import { GPS51CredentialsManager } from '@/services/gp51/GPS51CredentialsManager';
import { GPS51ProxyClient } from '@/services/gps51/GPS51ProxyClient';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: any;
}

export const GPS51ProductionReadinessPanel = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [overallStatus, setOverallStatus] = useState<'ready' | 'not-ready' | 'warnings' | 'pending'>('pending');

  const runProductionReadinessCheck = async () => {
    setIsRunning(true);
    const checks: HealthCheck[] = [];

    try {
      // 1. Credentials Check
      console.log('Production Check: Verifying GPS51 credentials...');
      const credentialsManager = new GPS51CredentialsManager();
      const credentials = await credentialsManager.getCredentials();
      
      if (!credentials) {
        checks.push({
          name: 'GPS51 Credentials',
          status: 'fail',
          message: 'No GPS51 credentials configured',
          details: { hasCredentials: false }
        });
      } else {
        // Enhanced credential validation
        const { GPS51Utils } = await import('@/services/gps51/GPS51Utils');
        const passwordInfo = GPS51Utils.getPasswordValidationInfo(credentials.password);
        
        checks.push({
          name: 'GPS51 Credentials',
          status: passwordInfo.isValidMD5 ? 'pass' : 'warning',
          message: passwordInfo.isValidMD5 
            ? 'GPS51 credentials are properly configured' 
            : 'Credentials configured but password may need re-hashing',
          details: { 
            username: credentials.username,
            hasPassword: passwordInfo.isAvailable,
            passwordIsValidMD5: passwordInfo.isValidMD5,
            apiUrl: credentials.apiUrl,
            from: credentials.from,
            type: credentials.type
          }
        });
      }

      // 2. Authentication Test
      console.log('Production Check: Testing GPS51 authentication...');
      try {
        if (credentials) {
          const authResult = await gps51AuthService.authenticate(credentials);
          if (authResult) {
            checks.push({
              name: 'GPS51 Authentication',
              status: 'pass',
              message: 'GPS51 authentication successful',
              details: { authenticated: true, user: gps51AuthService.getUser() }
            });
          } else {
            checks.push({
              name: 'GPS51 Authentication',
              status: 'fail',
              message: 'GPS51 authentication failed',
              details: { authenticated: false }
            });
          }
        } else {
          checks.push({
            name: 'GPS51 Authentication',
            status: 'fail',
            message: 'Cannot test authentication without credentials',
            details: { skipped: true }
          });
        }
      } catch (error) {
        checks.push({
          name: 'GPS51 Authentication',
          status: 'fail',
          message: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }

      // 3. Intelligent Connection Test
      console.log('Production Check: Testing intelligent connection strategies...');
      try {
        const { gps51IntelligentConnectionManager } = await import('@/services/gps51/GPS51IntelligentConnectionManager');
        const connectionTest = await gps51IntelligentConnectionManager.testAllConnections('https://api.gps51.com/openapi');
        const healthStatus = gps51IntelligentConnectionManager.getConnectionHealth();
        
        const proxyResult = connectionTest.get('proxy');
        
        if (proxyResult?.success) {
          checks.push({
            name: 'Connection Strategy Test',
            status: 'pass',
            message: `Proxy connection working (${proxyResult.responseTime}ms)`,
            details: { 
              proxyResult,
              healthStatus,
              recommendedStrategy: healthStatus.recommendedStrategy 
            }
          });
        } else {
          checks.push({
            name: 'Connection Strategy Test',
            status: 'fail',
            message: `Connection strategies failed: ${proxyResult?.error || 'Unknown error'}`,
            details: { proxyResult, healthStatus }
          });
        }
      } catch (error) {
        checks.push({
          name: 'Connection Strategy Test',
          status: 'fail',
          message: `Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }

      // 4. Device Data Test
      console.log('Production Check: Testing device data retrieval...');
      try {
        if (gps51AuthService.isAuthenticated()) {
          const client = gps51AuthService.getClient();
          const devices = await client.getDeviceList();
          
          if (devices.length > 0) {
            checks.push({
              name: 'Device Data Retrieval',
              status: 'pass',
              message: `Successfully retrieved ${devices.length} devices`,
              details: { deviceCount: devices.length, devices: devices.slice(0, 3) }
            });
          } else {
            checks.push({
              name: 'Device Data Retrieval',
              status: 'warning',
              message: 'No devices found in GPS51 account',
              details: { deviceCount: 0 }
            });
          }
        } else {
          checks.push({
            name: 'Device Data Retrieval',
            status: 'fail',
            message: 'Cannot test device data without authentication',
            details: { skipped: true }
          });
        }
      } catch (error) {
        checks.push({
          name: 'Device Data Retrieval',
          status: 'fail',
          message: `Device data error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }

      // 5. Position Data Test
      console.log('Production Check: Testing position data retrieval...');
      try {
        if (gps51AuthService.isAuthenticated()) {
          const client = gps51AuthService.getClient();
          const positionResult = await client.getRealtimePositions();
          
          checks.push({
            name: 'Position Data Retrieval',
            status: 'pass',
            message: `Position API working (${positionResult.positions.length} positions)`,
            details: { 
              positionCount: positionResult.positions.length,
              lastQueryTime: positionResult.lastQueryTime 
            }
          });
        } else {
          checks.push({
            name: 'Position Data Retrieval',
            status: 'fail',
            message: 'Cannot test position data without authentication',
            details: { skipped: true }
          });
        }
      } catch (error) {
        checks.push({
          name: 'Position Data Retrieval',
          status: 'warning',
          message: `Position data warning: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }

      // Calculate overall status
      const failedChecks = checks.filter(c => c.status === 'fail').length;
      const warningChecks = checks.filter(c => c.status === 'warning').length;
      
      if (failedChecks > 0) {
        setOverallStatus('not-ready');
      } else if (warningChecks > 0) {
        setOverallStatus('warnings');
      } else {
        setOverallStatus('ready');
      }

      setHealthChecks(checks);
      console.log('Production Check: Completed', { 
        totalChecks: checks.length,
        passed: checks.filter(c => c.status === 'pass').length,
        failed: failedChecks,
        warnings: warningChecks,
        overallStatus: failedChecks > 0 ? 'not-ready' : warningChecks > 0 ? 'warnings' : 'ready'
      });

    } catch (error) {
      console.error('Production Check: Unexpected error:', error);
      setOverallStatus('not-ready');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOverallStatusBadge = () => {
    switch (overallStatus) {
      case 'ready':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Production Ready</Badge>;
      case 'warnings':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Ready with Warnings</Badge>;
      case 'not-ready':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Not Production Ready</Badge>;
      default:
        return <Badge variant="outline">Status Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Production Readiness Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Verify GPS51 integration is ready for production use
            </p>
            {healthChecks.length > 0 && (
              <div className="flex items-center gap-2">
                {getOverallStatusBadge()}
              </div>
            )}
          </div>
          <Button 
            onClick={runProductionReadinessCheck} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Checks...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                Run Production Check
              </>
            )}
          </Button>
        </div>

        {healthChecks.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Health Check Results</h4>
            <div className="space-y-2">
              {healthChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <div>
                      <div className="font-medium text-sm">{check.name}</div>
                      <div className="text-xs text-muted-foreground">{check.message}</div>
                    </div>
                  </div>
                  {check.details && (
                    <div className="text-xs text-muted-foreground max-w-xs truncate">
                      {JSON.stringify(check.details)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {overallStatus === 'not-ready' && (
          <Alert>
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Critical issues detected. GPS51 integration is not ready for production.
              <br />
              <strong>Recommendations:</strong>
              <br />
              ⚠️ Fix credential configuration and authentication issues
              <br />
              ⚠️ Ensure Supabase Edge Functions are properly deployed
              <br />
              ⚠️ Verify GPS51 API connectivity
            </AlertDescription>
          </Alert>
        )}

        {overallStatus === 'warnings' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              GPS51 integration is functional but has warnings.
              <br />
              <strong>Recommendations:</strong>
              <br />
              ⚠️ Consider using proxy connection for better reliability
              <br />
              ⚠️ Monitor connection performance and implement fallbacks
            </AlertDescription>
          </Alert>
        )}

        {overallStatus === 'ready' && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              🎉 GPS51 integration is ready for production deployment!
              <br />
              ✅ All critical systems are functioning correctly
              <br />
              ✅ Intelligent connection management is active
              <br />
              ✅ Ready to fetch live vehicle and user data
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};