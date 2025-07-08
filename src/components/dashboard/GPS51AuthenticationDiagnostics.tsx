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
import { gps51UnifiedAuthService } from '@/services/gps51/GPS51UnifiedAuthService';
import { gps51AuthStateSync } from '@/services/gps51/GPS51AuthStateSync';
import { GPS51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';

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
      // 1. Check Unified Auth Service
      const unifiedStatus = gps51UnifiedAuthService.getAuthenticationStatus();
      results.push({
        service: 'Unified Auth Service',
        status: unifiedStatus.isAuthenticated ? 'success' : 'warning',
        message: unifiedStatus.isAuthenticated 
          ? `Authenticated as ${unifiedStatus.user?.username || 'Unknown'}`
          : 'Not authenticated',
        details: unifiedStatus.diagnostics
      });

      // 2. Check Auth State Synchronization
      const syncState = gps51AuthStateSync.getCurrentState();
      results.push({
        service: 'Auth State Sync',
        status: syncState.isAuthenticated ? 'success' : 'warning',
        message: syncState.isAuthenticated 
          ? `Synchronized (${syncState.source}): ${syncState.username}`
          : 'No synchronized state',
        details: {
          source: syncState.source,
          timestamp: new Date(syncState.timestamp).toISOString(),
          isValid: gps51AuthStateSync.isAuthenticationValid()
        }
      });

      // 3. Check Emergency Manager
      const emergencyManager = GPS51EmergencyManager.getInstance();
      const emergencyAuth = emergencyManager.isAuthenticated();
      results.push({
        service: 'Emergency Manager',
        status: emergencyAuth ? 'success' : 'warning',
        message: emergencyAuth 
          ? `Emergency auth active: ${emergencyManager.getUsername()}`
          : 'Emergency authentication not active',
        details: emergencyManager.getDiagnostics()
      });

      // 4. Check GPS51 Client State
      const client = gps51UnifiedAuthService.getClient();
      const clientAuth = client.isAuthenticated();
      results.push({
        service: 'GPS51 Client',
        status: clientAuth ? 'success' : 'error',
        message: clientAuth 
          ? `Client authenticated with user: ${client.getUser()?.username || 'Missing username'}`
          : 'GPS51 Client not authenticated',
        details: {
          hasToken: !!client.getToken(),
          hasUser: !!client.getUser(),
          username: client.getUser()?.username
        }
      });

      // 5. Test Connection Health
      try {
        const connectionTest = await gps51UnifiedAuthService.testConnection();
        results.push({
          service: 'Connection Health',
          status: connectionTest.success ? 'success' : 'error',
          message: connectionTest.success 
            ? `Connection healthy (${connectionTest.responseTime}ms)`
            : `Connection failed: ${connectionTest.error}`,
          details: connectionTest
        });
      } catch (error) {
        results.push({
          service: 'Connection Health',
          status: 'error',
          message: `Connection test failed: ${error.message}`,
          details: { error: error.message }
        });
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