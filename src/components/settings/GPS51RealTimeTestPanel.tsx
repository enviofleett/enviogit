import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { gps51Client } from '@/services/gps51/GPS51Client';
import { GPS51DataFetcher } from '@/services/gps51/GPS51DataFetcher';
import { GPS51TimeManager } from '@/services/gps51/GPS51TimeManager';
import { Play, Square, RefreshCw, Clock, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

interface RealTimeStats {
  devicesTotal: number;
  devicesOnline: number;
  positionsReceived: number;
  lastQueryTime: number;
  serverTimeDrift: number;
  isConnected: boolean;
}

interface TimeAnalysis {
  currentTimestamp: number;
  thirtyMinutesAgo: number;
  sampleDeviceTimestamps: Array<{
    deviceName: string;
    deviceId: string;
    lastActiveTime: number;
    asMilliseconds: string;
    asSeconds: string;
    isOnlineMs: boolean;
    isOnlineSeconds: boolean;
  }>;
}

export const GPS51RealTimeTestPanel = () => {
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysis | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const runTimeAnalysis = async () => {
    try {
      addLog('🔍 Running detailed time analysis...');
      
      const dataFetcher = new GPS51DataFetcher(gps51Client);
      const devices = await dataFetcher.fetchUserDevices();
      
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      
      const sampleDeviceTimestamps = devices.slice(0, 10).map(device => {
        const lastActiveTime = device.lastactivetime || 0;
        return {
          deviceName: device.devicename,
          deviceId: device.deviceid,
          lastActiveTime,
          asMilliseconds: lastActiveTime ? new Date(lastActiveTime).toISOString() : 'Never',
          asSeconds: lastActiveTime ? new Date(lastActiveTime * 1000).toISOString() : 'Never',
          isOnlineMs: lastActiveTime > thirtyMinutesAgo,
          isOnlineSeconds: (lastActiveTime * 1000) > thirtyMinutesAgo
        };
      });

      setTimeAnalysis({
        currentTimestamp: now,
        thirtyMinutesAgo,
        sampleDeviceTimestamps
      });

      addLog(`📊 Time analysis complete. Found ${sampleDeviceTimestamps.filter(d => d.isOnlineMs).length} online (ms) vs ${sampleDeviceTimestamps.filter(d => d.isOnlineSeconds).length} online (seconds)`);

    } catch (error) {
      addLog(`❌ Time analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runRealTimeTest = async () => {
    setTesting(true);
    setError(null);
    setLogs([]);
    
    try {
      addLog('🔄 Starting real-time data test...');
      
      // Check authentication
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }
      addLog('✅ Authentication verified');

      // Run time analysis first
      await runTimeAnalysis();

      // Create data fetcher
      const dataFetcher = new GPS51DataFetcher(gps51Client);
      addLog('📡 Initializing data fetcher...');

      // Test device list first
      addLog('📋 Fetching device list...');
      const devices = await dataFetcher.fetchUserDevices();
      addLog(`📱 Found ${devices.length} total devices`);

      if (devices.length === 0) {
        throw new Error('No devices found for user');
      }

      // Test enhanced live data with detailed analysis
      addLog('🚀 Testing enhanced live data fetch...');
      const enhancedResult = await dataFetcher.fetchCompleteLiveData();
      
      addLog(`🎯 Enhanced result: ${enhancedResult.devices.length} devices, ${enhancedResult.positions.length} positions`);

      // Calculate stats
      const now = GPS51TimeManager.getCurrentUtcTimestamp();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      const onlineDevices = devices.filter(d => d.lastactivetime && d.lastactivetime > thirtyMinutesAgo);

      const newStats: RealTimeStats = {
        devicesTotal: devices.length,
        devicesOnline: onlineDevices.length,
        positionsReceived: enhancedResult.positions.length,
        lastQueryTime: enhancedResult.lastQueryTime,
        serverTimeDrift: Math.floor((now - enhancedResult.lastQueryTime) / 1000),
        isConnected: true
      };

      setStats(newStats);
      addLog(`✅ Test completed successfully!`);
      
      toast({
        title: "Real-Time Test Successful",
        description: `Found ${newStats.devicesOnline}/${newStats.devicesTotal} online devices, received ${newStats.positionsReceived} positions`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`❌ Error: ${errorMessage}`);
      setError(errorMessage);
      
      toast({
        title: "Real-Time Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setStats(null);
    setError(null);
    setTimeAnalysis(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          GPS51 Real-Time Data Test (Enhanced)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runRealTimeTest}
            disabled={testing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing...' : 'Run Real-Time Test'}
          </Button>
          
          <Button 
            onClick={runTimeAnalysis}
            disabled={testing}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Time Analysis Only
          </Button>
          
          <Button 
            onClick={clearLogs}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Square className="h-4 w-4" />
            Clear
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <div className="text-sm font-medium">Total Devices</div>
              <Badge variant="default">{stats.devicesTotal}</Badge>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Online Devices</div>
              <Badge variant={stats.devicesOnline > 0 ? 'default' : 'destructive'}>
                {stats.devicesOnline}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Positions Received</div>
              <Badge variant={stats.positionsReceived > 0 ? 'default' : 'outline'}>
                {stats.positionsReceived}
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Server Time Drift</div>
              <Badge variant={Math.abs(stats.serverTimeDrift) < 60 ? 'default' : 'destructive'}>
                {stats.serverTimeDrift}s
              </Badge>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Last Query Time</div>
              <div className="text-xs text-muted-foreground">
                {new Date(stats.lastQueryTime).toLocaleTimeString()}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm font-medium">Connection</div>
              <Badge variant={stats.isConnected ? 'default' : 'destructive'}>
                {stats.isConnected ? 'Active' : 'Failed'}
              </Badge>
            </div>
          </div>
        )}

        {timeAnalysis && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Time Analysis Results</h4>
            <div className="p-3 bg-muted rounded-lg text-xs space-y-2">
              <div>Current: {new Date(timeAnalysis.currentTimestamp).toISOString()}</div>
              <div>30min ago: {new Date(timeAnalysis.thirtyMinutesAgo).toISOString()}</div>
              
              <div className="space-y-1">
                <div className="font-medium">Sample Devices (first 10):</div>
                {timeAnalysis.sampleDeviceTimestamps.map((device, index) => (
                  <div key={index} className="pl-2 border-l border-border">
                    <div className="font-mono">{device.deviceName} ({device.deviceId})</div>
                    <div>Raw: {device.lastActiveTime}</div>
                    <div>As MS: {device.asMilliseconds} → {device.isOnlineMs ? '✅' : '❌'}</div>
                    <div>As S: {device.asSeconds} → {device.isOnlineSeconds ? '✅' : '❌'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Test Failed</span>
            </div>
            <div className="text-sm text-destructive/80 mt-1">{error}</div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Test Log
            </div>
            <ScrollArea className="h-48 w-full border rounded p-3">
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-sm font-mono text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};