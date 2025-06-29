
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import RealTimeMap from '@/components/dashboard/RealTimeMap';
import RealTimeGPS51Status from '@/components/dashboard/RealTimeGPS51Status';
import GPS51SyncButton from '@/components/dashboard/GPS51SyncButton';
import MonitoringAlertsPanel from '@/components/dashboard/MonitoringAlertsPanel';
import AIInsights from '@/components/dashboard/AIInsights';

const Dashboard = () => {
  const { 
    positions, 
    metrics, 
    loading, 
    error, 
    lastSyncTime,
    refresh
  } = useGPS51LiveData();

  // Get unique device IDs from positions
  const uniqueDevices = positions.reduce((acc, position) => {
    const deviceId = position.deviceid || '';
    if (deviceId && !acc.includes(deviceId)) {
      acc.push(deviceId);
    }
    return acc;
  }, [] as string[]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS51 Live Tracking Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time vehicle tracking and fleet management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueDevices.length}</div>
            <p className="text-xs text-muted-foreground">
              Total Devices
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {loading ? 'Connecting...' : metrics.realTimeConnected ? 'Connected' : 'Disconnected'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Real-Time Vehicle Tracking</CardTitle>
              <CardDescription>
                Live positions and movement tracking for all connected vehicles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealTimeMap />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {uniqueDevices.map((deviceId) => (
              <Card key={deviceId}>
                <CardHeader>
                  <CardTitle className="text-sm">{deviceId}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Device positions: {positions.filter(p => p.deviceid === deviceId).length}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Analytics data will be displayed here</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <MonitoringAlertsPanel />
        </TabsContent>

        <TabsContent value="ai">
          <AIInsights />
        </TabsContent>
      </Tabs>

      <div className="flex gap-4">
        <RealTimeGPS51Status />
        <GPS51SyncButton />
      </div>
    </div>
  );
};

export default Dashboard;
