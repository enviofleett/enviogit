
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FleetStats } from '@/components/dashboard/FleetStats';
import { RealTimeMap } from '@/components/dashboard/RealTimeMap';
import { VehicleCard } from '@/components/dashboard/VehicleCard';
import { RealtimeChart } from '@/components/dashboard/RealtimeChart';
import { RealTimeGPS51Status } from '@/components/dashboard/RealTimeGPS51Status';
import { GPS51SyncButton } from '@/components/dashboard/GPS51SyncButton';
import { RealTimeConnectionStatus } from '@/components/dashboard/RealTimeConnectionStatus';
import { MonitoringAlertsPanel } from '@/components/dashboard/MonitoringAlertsPanel';
import { AIInsights } from '@/components/dashboard/AIInsights';
import { useGPS51Data } from '@/hooks/useGPS51Data';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';

const Dashboard = () => {
  const { devices, positions, loading, error } = useGPS51Data();
  const { positions: livePositions, metrics } = useGPS51LiveData();

  // Combine stored and live data
  const allPositions = [...positions, ...livePositions];
  const activeDevices = devices.filter(device => 
    allPositions.some(pos => pos.deviceid === device.device_id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS51 Fleet Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time fleet monitoring and management system
        </p>
      </div>

      {/* Status and Control Panel */}
      <div className="flex gap-4 items-center">
        <RealTimeGPS51Status />
        <GPS51SyncButton />
        <RealTimeConnectionStatus />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6">
            <FleetStats devices={activeDevices} positions={allPositions} />
            <div className="grid lg:grid-cols-2 gap-6">
              <RealtimeChart />
              <MonitoringAlertsPanel />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map">
          <RealTimeMap positions={allPositions} />
        </TabsContent>

        <TabsContent value="vehicles">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeDevices.map((device) => (
              <VehicleCard 
                key={device.id} 
                vehicle={{
                  id: device.device_id,
                  name: device.device_name || device.device_id,
                  status: device.last_seen_at ? 'active' : 'inactive',
                  location: 'Unknown',
                  lastUpdate: device.last_seen_at || 'Never'
                }}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Analytics</CardTitle>
              <CardDescription>
                Detailed analytics and reporting for your GPS51 fleet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RealtimeChart />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <MonitoringAlertsPanel />
        </TabsContent>

        <TabsContent value="insights">
          <AIInsights />
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading GPS51 data...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-red-600">Error: {error}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
