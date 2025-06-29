
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGPS51EnhancedLiveData } from '@/hooks/useGPS51EnhancedLiveData';
import { GPS51LiveDataStatus } from '@/components/gps51/GPS51LiveDataStatus';
import { gps51PollingService } from '@/services/gps51/GPS51PollingService';
import { Activity, Car, Navigation, Zap } from 'lucide-react';

const GPS51Dashboard = () => {
  const [pollingEnabled, setPollingEnabled] = useState(true);
  
  const { 
    positions, 
    metrics, 
    loading, 
    error, 
    lastSyncTime,
    refresh,
    pollingActive
  } = useGPS51EnhancedLiveData({
    enabled: true,
    refreshInterval: 10000,
    enablePolling: pollingEnabled,
    priority: 1
  });

  const handleTogglePolling = () => {
    const newEnabled = !pollingEnabled;
    setPollingEnabled(newEnabled);
    
    if (newEnabled) {
      gps51PollingService.startPolling({
        interval: 10000,
        enabled: true,
        priority: 1
      });
    } else {
      gps51PollingService.stopPolling();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">GPS51 Fleet Dashboard</h1>
        <p className="text-muted-foreground">
          Enhanced real-time tracking and fleet management dashboard
        </p>
      </div>

      {/* Live Data Status */}
      <GPS51LiveDataStatus
        isConnected={!error && positions.length > 0}
        isPolling={pollingActive}
        lastSyncTime={lastSyncTime}
        error={error}
        loading={loading}
        onRefresh={refresh}
        onTogglePolling={handleTogglePolling}
        metrics={{
          totalDevices: metrics.totalDevices,
          activeDevices: metrics.activeDevices,
          movingVehicles: metrics.movingVehicles,
          offlineVehicles: metrics.offlineVehicles
        }}
      />

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

      {/* Recent Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Live Vehicle Positions</CardTitle>
          <CardDescription>
            Real-time GPS tracking data from GPS51 devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {positions.slice(0, 10).map((position) => (
              <div key={position.deviceid} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{position.deviceid}</div>
                  <div className="text-sm text-gray-600">
                    {position.callat.toFixed(6)}, {position.callon.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {position.strstatus || 'No status available'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{position.speed} km/h</div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    position.moving ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {position.moving ? 'Moving' : 'Stopped'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(position.updatetime).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {positions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Car className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No vehicle positions available</p>
                <p className="text-sm">Check your GPS51 connection and try refreshing</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51Dashboard;
