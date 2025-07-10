import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Network,
  Shield,
  Clock,
  Zap
} from 'lucide-react';
import { GPS51NetworkConnectivityService } from '@/services/gps51/GPS51NetworkConnectivityService';
import { GPS51ProxyClient } from '@/services/gps51/GPS51ProxyClient';

interface DiagnosticsResult {
  timestamp: string;
  directConnectivity: any;
  proxyConnectivity: any;
  recommendations: string[];
  canProceed: boolean;
  useProxy: boolean;
}

export const GPS51ConnectivityDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticsResult | null>(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);
    
    try {
      console.log('GPS51 Connectivity Diagnostics: Starting comprehensive test...');
      
      const connectivityService = new GPS51NetworkConnectivityService();
      const proxyClient = GPS51ProxyClient.getInstance();
      
      // Test direct connectivity
      console.log('Testing direct GPS51 API connectivity...');
      const directTest = await connectivityService.testGPS51APIAccessibility();
      const directDiagnosis = await connectivityService.diagnoseConnectivityIssues();
      
      // Test proxy connectivity
      console.log('Testing proxy connectivity...');
      const proxyTest = await proxyClient.testConnection();
      
      const recommendations: string[] = [];
      let canProceed = false;
      let useProxy = false;
      
      // Determine best approach - Always prefer proxy for browser apps
      if (proxyTest.success) {
        recommendations.push('✅ Proxy connection works - this is the correct approach for browser apps');
        useProxy = true;
        canProceed = true;
      } else {
        recommendations.push('❌ Proxy connection failed - this needs to be fixed');
        recommendations.push('Direct browser access to GPS51 API is blocked by CORS (this is normal)');
        if (directDiagnosis.canProceed) {
          recommendations.push('✅ Basic connectivity to GPS51 API is working');
          recommendations.push('🔧 Focus on fixing the Edge Function proxy configuration');
          canProceed = true;
        } else {
          recommendations.push('❌ No connectivity to GPS51 API detected');
          recommendations.push(...directDiagnosis.recommendations);
        }
      }
      
      const result: DiagnosticsResult = {
        timestamp: new Date().toISOString(),
        directConnectivity: {
          ...directTest,
          diagnosis: directDiagnosis
        },
        proxyConnectivity: proxyTest,
        recommendations,
        canProceed,
        useProxy
      };
      
      setResults(result);
      
      if (canProceed) {
        toast({
          title: "Diagnostics Complete",
          description: useProxy ? 
            "GPS51 connection is possible via proxy" : 
            "GPS51 connection is possible directly",
        });
      } else {
        toast({
          title: "Connection Issues Detected",
          description: "Please review the diagnostics results",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Diagnostics failed:', error);
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const StatusBadge = ({ success, label }: { success: boolean; label: string }) => (
    <Badge variant={success ? 'default' : 'destructive'} className="flex items-center gap-1">
      {success ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          GPS51 Connectivity Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>
        </div>

        {results && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="direct">Direct Connection</TabsTrigger>
              <TabsTrigger value="proxy">Proxy Connection</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Connection Status
                  </h4>
                  <div className="space-y-1">
                    <StatusBadge 
                      success={results.directConnectivity.authenticationPossible} 
                      label="Direct Connection" 
                    />
                    <StatusBadge 
                      success={results.proxyConnectivity.success} 
                      label="Proxy Connection" 
                    />
                    <StatusBadge 
                      success={results.canProceed} 
                      label="Can Proceed" 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Response Times
                  </h4>
                  <div className="text-sm space-y-1">
                    <div>Direct: {results.directConnectivity.connectivity.responseTime}ms</div>
                    <div>Proxy: {results.proxyConnectivity.responseTime}ms</div>
                  </div>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Recommendations:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {results.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </TabsContent>
            
            <TabsContent value="direct" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Direct API Connection Test</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Basic Connectivity</div>
                    <StatusBadge 
                      success={results.directConnectivity.connectivity.isReachable} 
                      label={results.directConnectivity.connectivity.isReachable ? 'Reachable' : 'Unreachable'} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Response Time</div>
                    <Badge variant="outline">
                      {results.directConnectivity.connectivity.responseTime}ms
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Diagnostic Details</div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatusBadge 
                      success={results.directConnectivity.diagnostics.headRequestWorks} 
                      label="HEAD Request" 
                    />
                    <StatusBadge 
                      success={results.directConnectivity.diagnostics.getRequestWorks} 
                      label="GET Request" 
                    />
                    <StatusBadge 
                      success={results.directConnectivity.diagnostics.postRequestWorks} 
                      label="POST Request" 
                    />
                    <StatusBadge 
                      success={results.directConnectivity.diagnostics.corsEnabled} 
                      label="CORS Enabled" 
                    />
                  </div>
                </div>

                {results.directConnectivity.diagnosis.issues.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="font-medium">Issues Detected:</div>
                        <ul className="list-disc list-inside text-sm">
                          {results.directConnectivity.diagnosis.issues.map((issue: string, index: number) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="proxy" className="space-y-4">
              <div className="space-y-3">
                <h4 className="font-medium">Proxy Connection Test</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Proxy Status</div>
                    <StatusBadge 
                      success={results.proxyConnectivity.success} 
                      label={results.proxyConnectivity.success ? 'Working' : 'Failed'} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Response Time</div>
                    <Badge variant="outline">
                      {results.proxyConnectivity.responseTime}ms
                    </Badge>
                  </div>
                </div>

                {results.proxyConnectivity.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">Proxy Error:</div>
                      <div className="text-sm">{results.proxyConnectivity.error}</div>
                    </AlertDescription>
                  </Alert>
                )}

                {results.proxyConnectivity.success && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Proxy connection is working! This provides the most reliable way to connect to GPS51 API as it bypasses CORS restrictions and provides better error handling.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};