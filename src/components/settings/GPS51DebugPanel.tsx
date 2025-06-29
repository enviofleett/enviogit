
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Database, Wifi, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';
import { gps51Client } from '@/services/gps51/GPS51Client';
import { GPS51DataService } from '@/services/gps51/GPS51DataService';
import { supabase } from '@/integrations/supabase/client';

export const GPS51DebugPanel: React.FC = () => {
  const { status } = useGPS51SessionBridge();
  const [debugData, setDebugData] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionTest, setConnectionTest] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-49), `[${timestamp}] ${message}`]);
  };

  const refreshDebugData = async () => {
    setIsRefreshing(true);
    addLog('Starting debug data refresh...');
    
    try {
      // Get client status
      const clientStatus = {
        isAuthenticated: gps51Client.isAuthenticated(),
        token: gps51Client.getToken() ? 'Present' : 'Missing',
        user: gps51Client.getUser(),
        lastActivity: gps51Client.getLastActivity()
      };

      // Test database connection
      const { data: dbTest, error: dbError } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      const databaseStatus = {
        connected: !dbError,
        error: dbError?.message,
        testResult: dbTest ? 'Success' : 'Failed'
      };

      // Get stored data counts
      const dataService = GPS51DataService.getInstance();
      const storedData = await dataService.getStoredDataSummary();

      setDebugData({
        client: clientStatus,
        database: databaseStatus,
        storedData,
        sessionStatus: status,
        timestamp: new Date().toISOString()
      });

      addLog('Debug data refresh completed successfully');
    } catch (error) {
      console.error('Debug refresh failed:', error);
      addLog(`Debug refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const testConnection = async () => {
    addLog('Testing GPS51 connection...');
    
    try {
      const testResult = {
        timestamp: new Date().toISOString(),
        steps: []
      };

      // Test 1: Authentication
      testResult.steps.push({
        step: 'Authentication',
        status: gps51Client.isAuthenticated() ? 'success' : 'failed',
        details: gps51Client.isAuthenticated() ? 'Client is authenticated' : 'Client not authenticated'
      });

      // Test 2: Get device list
      try {
        const devices = await gps51Client.getDeviceList();
        testResult.steps.push({
          step: 'Device List',
          status: 'success',
          details: `Found ${devices.length} devices`
        });
      } catch (error) {
        testResult.steps.push({
          step: 'Device List',
          status: 'failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      setConnectionTest(testResult);
      addLog('Connection test completed');
    } catch (error) {
      addLog(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const performSync = async () => {
    addLog('Starting manual sync...');
    
    try {
      const dataService = GPS51DataService.getInstance();
      const result = await dataService.syncAllData();
      
      addLog(`Sync completed: ${result.devicesStored} devices, ${result.positionsStored} positions`);
      await refreshDebugData();
    } catch (error) {
      addLog(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Logs cleared');
  };

  useEffect(() => {
    refreshDebugData();
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            GPS51 Debug Panel
          </CardTitle>
          <CardDescription>
            Debug information, connection testing, and system diagnostics for GPS51 integration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={refreshDebugData} 
              disabled={isRefreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button 
              onClick={testConnection}
              variant="outline"
              size="sm"
            >
              <Wifi className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            <Button 
              onClick={performSync}
              variant="outline"
              size="sm"
            >
              <Database className="h-4 w-4 mr-2" />
              Manual Sync
            </Button>
          </div>

          <Tabs defaultValue="status" className="space-y-4">
            <TabsList>
              <TabsTrigger value="status">System Status</TabsTrigger>
              <TabsTrigger value="data">Stored Data</TabsTrigger>
              <TabsTrigger value="connection">Connection Test</TabsTrigger>
              <TabsTrigger value="logs">Activity Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="status">
              {debugData && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">GPS51 Client</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Authenticated:</span>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(debugData.client.isAuthenticated)}
                            <Badge variant={debugData.client.isAuthenticated ? 'default' : 'destructive'}>
                              {debugData.client.isAuthenticated ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Token:</span>
                          <Badge variant={debugData.client.token === 'Present' ? 'default' : 'secondary'}>
                            {debugData.client.token}
                          </Badge>
                        </div>
                        {debugData.client.user && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm">User:</span>
                            <span className="text-sm text-muted-foreground">
                              {debugData.client.user.gps51_username || 'Unknown'}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Database</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Connected:</span>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(debugData.database.connected)}
                            <Badge variant={debugData.database.connected ? 'default' : 'destructive'}>
                              {debugData.database.connected ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        </div>
                        {debugData.database.error && (
                          <div className="text-xs text-red-600">
                            {debugData.database.error}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Session Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Configured:</span>
                          <Badge variant={status.isConfigured ? 'default' : 'secondary'}>
                            {status.isConfigured ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Connected:</span>
                          <Badge variant={status.isConnected ? 'default' : 'secondary'}>
                            {status.isConnected ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Authenticated:</span>
                          <Badge variant={status.isAuthenticated ? 'default' : 'secondary'}>
                            {status.isAuthenticated ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                      {status.lastSync && (
                        <div className="flex items-center gap-2 pt-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Last Sync: {status.lastSync.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="data">
              {debugData?.storedData && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{debugData.storedData.users}</div>
                      <p className="text-xs text-muted-foreground">Total users stored</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Devices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{debugData.storedData.devices}</div>
                      <p className="text-xs text-muted-foreground">Total devices stored</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Positions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{debugData.storedData.positions}</div>
                      <p className="text-xs text-muted-foreground">Total positions stored</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="connection">
              {connectionTest && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Connection Test Results</CardTitle>
                    <CardDescription className="text-xs">
                      Performed at {new Date(connectionTest.timestamp).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {connectionTest.steps.map((step: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(step.status === 'success')}
                            <span className="font-medium text-sm">{step.step}</span>
                          </div>
                          <div className="text-right">
                            <Badge variant={step.status === 'success' ? 'default' : 'destructive'}>
                              {step.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1">
                              {step.details}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Activity Logs</CardTitle>
                    <Button onClick={clearLogs} variant="outline" size="sm">
                      Clear Logs
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] w-full">
                    <div className="space-y-1">
                      {logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono p-2 bg-gray-50 rounded">
                          {log}
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-xs text-muted-foreground p-2">
                          No logs available. Activity will appear here.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
