import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Network, 
  Clock, 
  Shield,
  Wifi,
  Server
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GPS51NetworkConnectivityService } from '@/services/gps51/GPS51NetworkConnectivityService';
import { GPS51ProxyClient } from '@/services/gps51/GPS51ProxyClient';
import { gps51IntelligentConnectionManager } from '@/services/gps51/GPS51IntelligentConnectionManager';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  responseTime?: number;
}

export const GPS51ConnectionDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const { toast } = useToast();

  const runComprehensiveDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const diagnosticResults: DiagnosticResult[] = [];

    try {
      // 1. Network Connectivity Test
      const connectivityService = new GPS51NetworkConnectivityService();
      const connectivityResult = await connectivityService.testNetworkConnectivity();
      
      diagnosticResults.push({
        name: 'Network Connectivity',
        status: connectivityResult.isReachable ? 'success' : 'error',
        message: connectivityResult.isReachable 
          ? `GPS51 API reachable (${connectivityResult.responseTime}ms)`
          : `Cannot reach GPS51 API: ${connectivityResult.errorMessage}`,
        responseTime: connectivityResult.responseTime,
        details: {
          statusCode: connectivityResult.statusCode,
          errorType: connectivityResult.errorType,
          recommendedAction: connectivityResult.recommendedAction
        }
      });

      // 2. CORS Policy Test
      const corsTest = await connectivityService.testGPS51APIAccessibility();
      diagnosticResults.push({
        name: 'CORS Policy Check',
        status: corsTest.diagnostics.corsEnabled ? 'success' : 'warning',
        message: corsTest.diagnostics.corsEnabled 
          ? 'CORS enabled - direct browser access possible'
          : 'CORS restricted - proxy required (normal for production)',
        details: {
          getRequestWorks: corsTest.diagnostics.getRequestWorks,
          postRequestWorks: corsTest.diagnostics.postRequestWorks,
          headRequestWorks: corsTest.diagnostics.headRequestWorks
        }
      });

      // 3. Supabase Edge Function Proxy Test
      const proxyClient = GPS51ProxyClient.getInstance();
      const proxyTest = await proxyClient.testConnection();
      
      diagnosticResults.push({
        name: 'Supabase Edge Function Proxy',
        status: proxyTest.success ? 'success' : 'error',
        message: proxyTest.success 
          ? `Proxy operational (${proxyTest.responseTime}ms)`
          : `Proxy error: ${proxyTest.error}`,
        responseTime: proxyTest.responseTime,
        details: proxyTest.healthStatus
      });

      // 4. Connection Strategy Health
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      diagnosticResults.push({
        name: 'Connection Strategy',
        status: connectionHealth.overallHealth === 'good' ? 'success' 
               : connectionHealth.overallHealth === 'degraded' ? 'warning' : 'error',
        message: `Overall health: ${connectionHealth.overallHealth}. Recommended: ${connectionHealth.recommendedStrategy}`,
        details: {
          strategies: connectionHealth.strategies,
          recommendedStrategy: connectionHealth.recommendedStrategy
        }
      });

      // 5. SSL Certificate Validation
      diagnosticResults.push({
        name: 'SSL Certificate',
        status: corsTest.diagnostics.sslValid ? 'success' : 'error',
        message: corsTest.diagnostics.sslValid 
          ? 'SSL certificate valid'
          : 'SSL certificate validation failed',
        details: {
          sslValid: corsTest.diagnostics.sslValid
        }
      });

      setResults(diagnosticResults);

      // Show summary toast
      const errorCount = diagnosticResults.filter(r => r.status === 'error').length;
      const warningCount = diagnosticResults.filter(r => r.status === 'warning').length;
      
      if (errorCount === 0) {
        toast({
          title: "Diagnostics Complete",
          description: `All systems operational${warningCount > 0 ? ` (${warningCount} warnings)` : ''}`,
        });
      } else {
        toast({
          title: "Issues Detected",
          description: `Found ${errorCount} errors and ${warningCount} warnings`,
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('Diagnostic test failed:', error);
      toast({
        title: "Diagnostic Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          GPS51 Connection Diagnostics
        </CardTitle>
        <CardDescription>
          Comprehensive diagnostics to identify and resolve GPS51 authentication issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runComprehensiveDiagnostics}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Running Diagnostics...
            </div>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Run Complete Diagnostics
            </>
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Diagnostic Results:</h3>
            {results.map((result, index) => (
              <Alert key={index} className={getStatusColor(result.status)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="font-medium text-sm">{result.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {result.message}
                      </div>
                      {result.responseTime && (
                        <Badge variant="outline" className="mt-2">
                          <Clock className="h-3 w-3 mr-1" />
                          {result.responseTime}ms
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {results.some(r => r.status === 'error') && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical Issues Detected:</strong> Your GPS51 connection has errors that need attention.
              The most common issue is trying to make direct API calls instead of using the Supabase Edge Function proxy.
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && !results.some(r => r.status === 'error') && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>System Health Good:</strong> GPS51 connection infrastructure is working properly.
              If you're still experiencing authentication issues, check your credentials.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};