import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Users, 
  Key, 
  Wifi,
  RefreshCw,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';

interface DiagnosticInfo {
  service: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export const GPS51AuthenticationDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);
    const results: DiagnosticInfo[] = [];

    try {
      // 1. Check Configuration Storage
      const isConfigured = GPS51ConfigStorage.isConfigured();
      const config = GPS51ConfigStorage.getConfiguration();
      results.push({
        service: 'Configuration Storage',
        status: isConfigured ? 'success' : 'error',
        message: isConfigured 
          ? `Configured for ${config?.username || 'Unknown'}`
          : 'GPS51 credentials not configured',
        details: {
          hasApiUrl: !!config?.apiUrl,
          hasUsername: !!config?.username,
          hasPassword: !!config?.password,
          apiUrl: config?.apiUrl,
          from: config?.from,
          type: config?.type
        }
      });

      // 2. Check Unified Service Auth State
      const authState = gps51ProductionService.getAuthState();
      results.push({
        service: 'Unified Service',
        status: authState.isAuthenticated ? 'success' : 'warning',
        message: authState.isAuthenticated 
          ? `Authenticated as ${authState.username || 'Unknown'}`
          : 'Not authenticated - credentials may need validation',
        details: {
          isAuthenticated: authState.isAuthenticated,
          hasToken: !!authState.token,
          username: authState.username,
          error: authState.error
        }
      });

      // 3. Check Service Status
      const serviceStatus = gps51ProductionService.getServiceStatus();
      results.push({
        service: 'Service Status',
        status: serviceStatus.isAuthenticated ? 'success' : 'warning',
        message: `${serviceStatus.deviceCount} devices, ${serviceStatus.movingVehicles} moving`,
        details: serviceStatus
      });

      // 4. Test Authentication if configured but not authenticated
      if (isConfigured && !authState.isAuthenticated) {
        try {
          console.log('GPS51AuthenticationDiagnostics: Testing authentication...');
          const authResult = await gps51ProductionService.authenticate(config?.username || '', config?.password || '');
          results.push({
            service: 'Authentication Test',
            status: authResult.isAuthenticated ? 'success' : 'error',
            message: authResult.isAuthenticated 
              ? `Authentication successful`
              : `Authentication failed: ${authResult.error}`,
            details: authResult
          });
        } catch (error) {
          results.push({
            service: 'Authentication Test',
            status: 'error',
            message: `Authentication test failed: ${error.message}`,
            details: { error: error.message }
          });
        }
      }

      setDiagnostics(results);

      // Show summary
      const errorCount = results.filter(r => r.status === 'error').length;
      const warningCount = results.filter(r => r.status === 'warning').length;

      if (errorCount === 0 && warningCount === 0) {
        toast({
          title: "All Systems Operational",
          description: "GPS51 authentication is working correctly",
        });
      } else if (errorCount > 0) {
        toast({
          title: "Critical Issues Found",
          description: `${errorCount} errors and ${warningCount} warnings detected`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Minor Issues Found",
          description: `${warningCount} warnings detected`,
        });
      }

    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticInfo['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticInfo['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  // Auto-run diagnostics on mount
  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          GPS51 Authentication Diagnostics
        </CardTitle>
        <CardDescription>
          Comprehensive analysis of GPS51 authentication state and service health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <div className="flex items-center">
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </div>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Diagnostics
            </>
          )}
        </Button>

        {diagnostics.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Service Status:</h3>
            {diagnostics.map((diagnostic, index) => (
              <Alert key={index} className={getStatusColor(diagnostic.status)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getStatusIcon(diagnostic.status)}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{diagnostic.service}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {diagnostic.message}
                      </div>
                      {diagnostic.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                            Show Details
                          </summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto max-h-20">
                            {JSON.stringify(diagnostic.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {diagnostics.some(d => d.status === 'error') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Authentication Issues:</strong> Your GPS51 authentication has errors.
              The most common fix is ensuring the username is properly set in the GPS51Client
              and all API calls use the Supabase Edge Function proxy.
            </AlertDescription>
          </Alert>
        )}

        {diagnostics.length > 0 && !diagnostics.some(d => d.status === 'error') && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Authentication System Healthy:</strong> All GPS51 authentication services
              are operating correctly. Device data should be accessible.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};