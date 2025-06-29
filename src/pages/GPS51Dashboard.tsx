
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import { Activity, Car, Navigation, Zap } from 'lucide-react';

const GPS51Dashboard = () => {
  const { positions, metrics, loading, error, lastSyncTime } = useGPS51LiveData({
    enabled: true,
    refreshInterval: 30000,
    enableWebSocket: true,
    enableIntelligentFiltering: true
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <h3 className="font-semibold">Connection Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS51 Fleet Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time tracking and fleet management dashboard
        </p>
      </div>

      {/* Fleet Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.vehiclesWithGPS} with GPS tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDevices}</div>
            <p className="text-xs text-muted-foreground">
              Currently reporting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moving Vehicles</CardTitle>
            <Navigation className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.movingVehicles}</div>
            <p className="text-xs text-muted-foreground">
              Currently in motion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parked Vehicles</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.parkedDevices}</div>
            <p className="text-xs text-muted-foreground">
              Stationary with GPS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>
            GPS51 API connection and data synchronization status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Real-time Connection:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                metrics.realTimeConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {metrics.realTimeConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Offline Vehicles:</span>
              <span>{metrics.offlineVehicles}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last Update:</span>
              <span>{lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Vehicle Positions</CardTitle>
          <CardDescription>
            Latest position updates from GPS51 devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {positions.slice(0, 10).map((position) => (
              <div key={position.deviceid} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{position.deviceid}</div>
                  <div className="text-sm text-gray-600">
                    {position.callat.toFixed(6)}, {position.callon.toFixed(6)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{position.speed} km/h</div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    position.moving ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {position.moving ? 'Moving' : 'Stopped'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51Dashboard;
