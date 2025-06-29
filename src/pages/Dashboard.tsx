
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import FleetStats from '@/components/dashboard/FleetStats';
import RealTimeMap from '@/components/dashboard/RealTimeMap';
import VehicleCard from '@/components/dashboard/VehicleCard';
import RealtimeChart from '@/components/dashboard/RealtimeChart';
import RealTimeGPS51Status from '@/components/dashboard/RealTimeGPS51Status';
import GPS51SyncButton from '@/components/dashboard/GPS51SyncButton';
import RealTimeConnectionStatus from '@/components/dashboard/RealTimeConnectionStatus';
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
        <FleetStats 
          metrics={metrics}
          loading={loading}
        />
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <RealTimeConnectionStatus 
              connected={metrics.realTimeConnected}
              lastUpdateTime={metrics.lastUpdateTime}
            />
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
              <RealTimeMap 
                positions={positions}
                loading={loading}
                error={error}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {uniqueDevices.map((deviceId) => (
              <VehicleCard 
                key={deviceId}
                deviceId={deviceId}
                positions={positions.filter(p => p.deviceid === deviceId)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-4">
            <RealtimeChart 
              positions={positions}
              loading={loading}
            />
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <MonitoringAlertsPanel />
        </TabsContent>

        <TabsContent value="ai">
          <AIInsights 
            positions={positions}
            metrics={metrics}
          />
        </TabsContent>
      </Tabs>

      <div className="flex gap-4">
        <RealTimeGPS51Status />
        <GPS51SyncButton 
          onSync={refresh}
          loading={loading}
          lastSyncTime={lastSyncTime}
        />
      </div>
    </div>
  );
};

export default Dashboard;
