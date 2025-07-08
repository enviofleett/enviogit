import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Monitor, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wrench,
  Info,
  HelpCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gps51ProductionService, GPS51Vehicle } from '@/services/gps51/GPS51ProductionService';

// Simplified diagnostics interface
interface GPS51DeviceDiagnostics {
  discoverDevices(): Promise<DiagnosticResult>;
}
// Using simple device display instead of complex components

interface DiagnosticResult {
  success: boolean;
  devices: GPS51Vehicle[];
  diagnostics: {
    authStatus: any;
    apiResponses: any[];
    attemptedMethods: string[];
    possibleIssues: string[];
    recommendations: string[];
  };
  fallbackDataAvailable: boolean;
}

export const GPS51EnhancedDeviceManager: React.FC = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<GPS51Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Mock diagnostics service using GPS51ProductionService
  const diagnosticsService = {
    async discoverDevices(): Promise<DiagnosticResult> {
      const authState = gps51ProductionService.getAuthState();
      const devices = await gps51ProductionService.fetchUserDevices();
      return {
        success: devices.length > 0,
        devices,
        diagnostics: {
          authStatus: authState,
          apiResponses: [],
          attemptedMethods: ['GPS51ProductionService.fetchUserDevices'],
          possibleIssues: devices.length === 0 ? ['No devices found'] : [],
          recommendations: devices.length === 0 ? ['Check GPS51 credentials'] : []
        },
        fallbackDataAvailable: false
      };
    }
  };

  const runComprehensiveDiagnostics = async () => {
    const authState = gps51ProductionService.getAuthState();
    if (!authState.isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please configure GPS51 credentials first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Starting comprehensive GPS51 device diagnostics...');
      
      const result = await diagnosticsService.discoverDevices();
      setDiagnosticResult(result);
      setDevices(result.devices);
      setLastSync(new Date());

      if (result.success) {
        toast({
          title: "Devices Found!",
          description: `Successfully discovered ${result.devices.length} devices using ${result.fallbackDataAvailable ? 'fallback' : 'standard'} method`,
        });
      } else {
        toast({
          title: "No Devices Found",
          description: `Tried ${result.diagnostics.attemptedMethods.length} different methods. Check diagnostics for details.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Enhanced device manager error:', error);
      toast({
        title: "Diagnostic Error",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickDeviceRefresh = async () => {
    const authState = gps51ProductionService.getAuthState();
    if (!authState.isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please configure GPS51 credentials first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('⚡ Quick device refresh...');
      const devices = await gps51ProductionService.fetchUserDevices();
      setDevices(devices);
      setLastSync(new Date());

      toast({
        title: devices.length > 0 ? "Devices Loaded" : "No Devices Found",
        description: devices.length > 0 
          ? `Found ${devices.length} devices`
          : "No devices returned from GPS51 API",
        variant: devices.length > 0 ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Quick refresh error:', error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-run diagnostics on mount if authenticated
  useEffect(() => {
    const authState = gps51ProductionService.getAuthState();
    if (authState.isAuthenticated) {
      runComprehensiveDiagnostics();
    }
  }, []);

  const filteredDevices = devices.filter(device => 
    device.devicename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.deviceid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.devicetype.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="w-5 h-5" />
            <span>Enhanced GPS51 Device Discovery</span>
            {diagnosticResult && getStatusIcon(diagnosticResult.success)}
          </CardTitle>
          <CardDescription>
            Advanced device detection with comprehensive diagnostics and fallback methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={runComprehensiveDiagnostics}
              disabled={loading || !gps51ProductionService.getAuthState().isAuthenticated}
              className="flex items-center"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Full Diagnostics
            </Button>
            
            <Button
              variant="outline"
              onClick={quickDeviceRefresh}
              disabled={loading || !gps51ProductionService.getAuthState().isAuthenticated}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Quick Refresh
            </Button>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              {lastSync && (
                <span>Last sync: {lastSync.toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {!gps51ProductionService.getAuthState().isAuthenticated && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                GPS51 authentication required. Please configure your credentials in the GPS51 settings.
              </AlertDescription>
            </Alert>
          )}

          {/* Results Tabs */}
          {(devices.length > 0 || diagnosticResult) && (
            <Tabs defaultValue="devices" className="space-y-4">
              <TabsList>
                <TabsTrigger value="devices" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Devices ({devices.length})
                </TabsTrigger>
                {diagnosticResult && (
                  <TabsTrigger value="diagnostics" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Diagnostics
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="devices" className="space-y-4">
                {devices.length > 0 ? (
                  <>
                    {/* Search */}
                    <div className="flex items-center space-x-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search devices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-md"
                      />
                    </div>

                    {/* Simple Device List */}
                    <div className="space-y-2">
                      {filteredDevices.map(device => (
                        <div key={device.deviceid} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{device.devicename}</div>
                              <div className="text-sm text-muted-foreground">ID: {device.deviceid}</div>
                            </div>
                            <div className="text-sm">
                              Status: {device.isMoving ? 'Moving' : 'Parked'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Success Alert */}
                    {diagnosticResult?.fallbackDataAvailable && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Devices loaded using fallback method. Standard API may have connectivity issues.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No devices found in your GPS51 account. See diagnostics tab for troubleshooting.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {diagnosticResult && (
                <TabsContent value="diagnostics" className="space-y-4">
                  {/* Authentication Status */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Authentication Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Authenticated:</span>
                          <Badge variant={diagnosticResult.diagnostics.authStatus.isAuthenticated ? 'default' : 'destructive'} className="ml-2">
                            {diagnosticResult.diagnostics.authStatus.isAuthenticated ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Username:</span>
                          <span className="ml-2 font-mono">{diagnosticResult.diagnostics.authStatus.username}</span>
                        </div>
                        <div>
                          <span className="font-medium">Has Token:</span>
                          <Badge variant={diagnosticResult.diagnostics.authStatus.hasToken ? 'default' : 'destructive'} className="ml-2">
                            {diagnosticResult.diagnostics.authStatus.hasToken ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Token Length:</span>
                          <span className="ml-2">{diagnosticResult.diagnostics.authStatus.tokenLength} chars</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Methods Attempted */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Methods Attempted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {diagnosticResult.diagnostics.attemptedMethods.map((method, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            <span className="text-sm">{method}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Issues Found */}
                  {diagnosticResult.diagnostics.possibleIssues.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          Issues Identified
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {diagnosticResult.diagnostics.possibleIssues.map((issue, index) => (
                            <Alert key={index} variant="destructive">
                              <AlertDescription>{issue}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommendations */}
                  {diagnosticResult.diagnostics.recommendations.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <HelpCircle className="h-5 w-5 text-blue-500" />
                          Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {diagnosticResult.diagnostics.recommendations.map((recommendation, index) => (
                            <Alert key={index}>
                              <AlertDescription>{recommendation}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* API Responses (Debug Info) */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">API Response Details</CardTitle>
                      <CardDescription>Raw API responses for debugging</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {diagnosticResult.diagnostics.apiResponses.map((response, index) => (
                          <div key={index} className="border rounded p-3">
                            <div className="font-medium text-sm mb-2">
                              {response.method} - {response.timestamp}
                            </div>
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                Show Response Data
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-40">
                                {JSON.stringify(response, null, 2)}
                              </pre>
                            </details>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};