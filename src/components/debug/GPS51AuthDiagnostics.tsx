import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Eye,
  EyeOff,
  Server,
  Clock,
  Database
} from 'lucide-react';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { GPS51CredentialChecker } from '@/services/gps51/GPS51CredentialChecker';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

export function GPS51AuthDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [lastAuthError, setLastAuthError] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];
    const timestamp = new Date().toISOString();

    try {
      // 1. Check credential storage
      const credentialStatus = GPS51CredentialChecker.checkCredentials();
      results.push({
        name: 'Credential Storage',
        status: credentialStatus.isConfigured ? 'success' : 'error',
        message: credentialStatus.isConfigured 
          ? 'Credentials are properly stored'
          : 'Credentials not configured',
        details: {
          hasUsername: credentialStatus.hasUsername,
          hasPassword: credentialStatus.hasPassword,
          hasApiUrl: credentialStatus.hasApiUrl,
          isConfigured: credentialStatus.isConfigured
        },
        timestamp
      });

      // 2. Check configuration format
      const config = GPS51ConfigStorage.getConfiguration();
      results.push({
        name: 'Configuration Format',
        status: config ? 'success' : 'error',
        message: config 
          ? 'Configuration format is valid'
          : 'Configuration format is invalid',
        details: config ? {
          hasAllFields: !!(config.username && config.password && config.apiUrl),
          passwordLength: config.password?.length,
          isPasswordMD5: /^[a-f0-9]{32}$/i.test(config.password || ''),
          apiUrl: config.apiUrl
        } : null,
        timestamp
      });

      // 3. Check Edge Function connectivity
      try {
        const testStart = Date.now();
        const { data, error } = await supabase.functions.invoke('gps51-auth', {
          body: { test: true }
        });
        const responseTime = Date.now() - testStart;
        
        results.push({
          name: 'Edge Function Connectivity',
          status: error ? 'error' : 'success',
          message: error 
            ? `Edge Function error: ${error.message}`
            : `Edge Function responsive (${responseTime}ms)`,
          details: {
            responseTime,
            error: error?.message,
            response: data
          },
          timestamp
        });
      } catch (edgeError: any) {
        results.push({
          name: 'Edge Function Connectivity',
          status: 'error',
          message: `Edge Function unreachable: ${edgeError.message}`,
          details: { error: edgeError.message },
          timestamp
        });
      }

      // 4. Check authentication service state
      const authState = gps51ProductionService.getAuthState();
      results.push({
        name: 'Authentication State',
        status: authState.isAuthenticated ? 'success' : 'warning',
        message: authState.isAuthenticated 
          ? `Authenticated as ${authState.username}`
          : 'Not currently authenticated',
        details: {
          isAuthenticated: authState.isAuthenticated,
          username: authState.username,
          hasToken: !!authState.token,
          tokenLength: authState.token?.length,
          error: authState.error
        },
        timestamp
      });

      // 5. Check localStorage for error history
      const lastError = localStorage.getItem('gps51_last_auth_error');
      const lastSuccess = localStorage.getItem('gps51_last_auth_success');
      
      if (lastError) {
        try {
          const errorData = JSON.parse(lastError);
          setLastAuthError(errorData);
          
          const errorAge = Date.now() - new Date(errorData.timestamp).getTime();
          const isRecent = errorAge < 5 * 60 * 1000; // 5 minutes
          
          results.push({
            name: 'Recent Authentication Errors',
            status: isRecent ? 'error' : 'warning',
            message: isRecent 
              ? `Recent authentication failure: ${errorData.error}`
              : `Previous authentication failure: ${errorData.error}`,
            details: {
              ...errorData,
              errorAge: Math.round(errorAge / 1000) + 's ago'
            },
            timestamp
          });
        } catch {
          results.push({
            name: 'Error History',
            status: 'warning',
            message: 'Could not parse error history',
            timestamp
          });
        }
      }

      if (lastSuccess) {
        const successAge = Date.now() - new Date(lastSuccess).getTime();
        results.push({
          name: 'Last Successful Authentication',
          status: 'success',
          message: `Last success: ${Math.round(successAge / 1000 / 60)} minutes ago`,
          details: { lastSuccess, successAge },
          timestamp
        });
      }

      // 6. Service status check
      const serviceStatus = gps51ProductionService.getServiceStatus();
      results.push({
        name: 'Production Service Status',
        status: serviceStatus.isAuthenticated ? 'success' : 'warning',
        message: `Service ready: ${serviceStatus.isAuthenticated ? 'Yes' : 'No'}`,
        details: {
          ...serviceStatus,
          // Remove sensitive data
          token: undefined
        },
        timestamp
      });

    } catch (error: any) {
      results.push({
        name: 'Diagnostic System',
        status: 'error',
        message: `Diagnostic error: ${error.message}`,
        details: { error: error.message },
        timestamp
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const clearErrorHistory = () => {
    localStorage.removeItem('gps51_last_auth_error');
    localStorage.removeItem('gps51_last_auth_success');
    setLastAuthError(null);
    runDiagnostics();
  };

  const errorCount = diagnostics.filter(d => d.status === 'error').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;
  const successCount = diagnostics.filter(d => d.status === 'success').length;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            GPS51 Authentication Diagnostics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={isRunning}
            >
              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{successCount} Passed</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span>{warningCount} Warnings</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>{errorCount} Errors</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {errorCount > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {errorCount} critical issue{errorCount > 1 ? 's' : ''} detected. 
              Please review the diagnostics below for resolution steps.
            </AlertDescription>
          </Alert>
        )}

        {lastAuthError && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>
                  Last authentication error: <strong>{lastAuthError.error}</strong>
                  <br />
                  <small className="text-muted-foreground">
                    {new Date(lastAuthError.timestamp).toLocaleString()}
                  </small>
                </span>
                <Button variant="outline" size="sm" onClick={clearErrorHistory}>
                  Clear History
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {diagnostics.map((diagnostic, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 border rounded-lg"
            >
              {getStatusIcon(diagnostic.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{diagnostic.name}</h3>
                  {getStatusBadge(diagnostic.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {diagnostic.message}
                </p>
                
                {showDetails && diagnostic.details && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs">
                    <Database className="h-3 w-3 inline mr-1" />
                    <strong>Details:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {JSON.stringify(diagnostic.details, null, 2)}
                    </pre>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(diagnostic.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {errorCount === 0 && warningCount === 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All GPS51 authentication systems are functioning normally.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}