import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  MapPin, 
  Car, 
  Zap, 
  Clock, 
  Navigation,
  Gauge,
  Fuel,
  Thermometer
} from 'lucide-react';
import { GPS51LiveMap } from './GPS51LiveMap';
import { LiveFleetMonitoringPanel } from './LiveFleetMonitoringPanel';
import { RealTimeAlertsPanel } from './RealTimeAlertsPanel';
import { useGPS51LiveTracking } from '@/hooks/useGPS51LiveTracking';

export const GPS51RealTimePanel: React.FC = () => {
  const {
    vehicles,
    isTracking,
    isLoading,
    error,
    lastUpdate,
    activeVehicleCount,
    movingVehicleCount,
    offlineVehicleCount,
    parkedVehicleCount,
    totalUpdates,
    startTracking,
    stopTracking,
    refreshNow,
    movingVehicles,
    parkedVehicles
  } = useGPS51LiveTracking({
    autoStart: true,
    baseInterval: 30000,
    adaptiveRefresh: true
  });

  // Quick stats cards data
  const stats = [
    {
      title: 'Total Vehicles',
      value: vehicles.length,
      description: 'Fleet size',
      icon: Car,
      color: 'text-blue-600'
    },
    {
      title: 'Active Now',
      value: movingVehicleCount,
      description: 'Currently moving',
      icon: Zap,
      color: 'text-green-600'
    },
    {
      title: 'Parked',
      value: parkedVehicleCount,
      description: 'Stationary vehicles',
      icon: Clock,
      color: 'text-yellow-600'
    },
    {
      title: 'Offline',
      value: offlineVehicleCount,
      description: 'No recent data',
      icon: Activity,
      color: 'text-gray-500'
    }
  ];

  // Get top speed vehicles
  const topSpeedVehicles = movingVehicles
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 5);

  // Get recently active vehicles
  const recentlyActive = vehicles
    .filter(v => v.lastUpdate > Date.now() - 300000) // 5 minutes
    .sort((a, b) => b.lastUpdate - a.lastUpdate)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Activity className="w-6 h-6" />
            <span>Real-Time Fleet Dashboard</span>
            {isTracking && (
              <Badge variant="default" className="ml-2 animate-pulse">
                Live
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Live vehicle tracking with 30-second updates
            {lastUpdate && (
              <span className="ml-2">• Last update: {lastUpdate.toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!isTracking && (
            <Button onClick={startTracking} disabled={isLoading}>
              <Activity className="w-4 h-4 mr-2" />
              Start Live Tracking
            </Button>
          )}
          {isTracking && (
            <Button variant="outline" onClick={stopTracking}>
              Stop Tracking
            </Button>
          )}
          <Button variant="outline" onClick={refreshNow} disabled={isLoading}>
            <Navigation className="w-4 h-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <Activity className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="monitoring">Fleet Monitoring</TabsTrigger>
          <TabsTrigger value="alerts">Real-Time Alerts</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicle Details</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Live Map Tab */}
        <TabsContent value="map">
          <GPS51LiveMap 
            autoStart={false} // Already managed by parent hook
            refreshInterval={30000}
            className="min-h-[600px]"
          />
        </TabsContent>

        {/* Fleet Monitoring Tab */}
        <TabsContent value="monitoring">
          <LiveFleetMonitoringPanel />
        </TabsContent>

        {/* Real-Time Alerts Tab */}
        <TabsContent value="alerts">
          <RealTimeAlertsPanel />
        </TabsContent>

        {/* Vehicle Details Tab */}
        <TabsContent value="vehicles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Speed Vehicles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Gauge className="w-5 h-5" />
                  <span>Fastest Moving</span>
                </CardTitle>
                <CardDescription>Vehicles with highest current speed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSpeedVehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No vehicles currently moving</p>
                  ) : (
                    topSpeedVehicles.map((vehicle, index) => (
                      <div key={vehicle.device.deviceid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          </div>
                          <div>
                            <p className="font-medium">{vehicle.device.devicename}</p>
                            <p className="text-sm text-muted-foreground">Moving</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{Math.round(vehicle.speed)} km/h</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(vehicle.lastUpdate).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recently Active */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Recently Active</span>
                </CardTitle>
                <CardDescription>Latest position updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentlyActive.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  ) : (
                    recentlyActive.map((vehicle) => (
                      <div key={vehicle.device.deviceid} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            vehicle.status === 'moving' ? 'bg-green-500 animate-pulse' :
                            vehicle.status === 'parked' ? 'bg-blue-500' : 'bg-gray-400'
                          }`} />
                          <div>
                            <p className="font-medium">{vehicle.device.devicename}</p>
                            <p className="text-sm text-muted-foreground capitalize">{vehicle.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {vehicle.status === 'moving' ? `${Math.round(vehicle.speed)} km/h` : 'Stopped'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(vehicle.lastUpdate).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tracking Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Tracking Stats</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Total Updates:</span>
                  <span className="font-medium">{totalUpdates}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Tracking Status:</span>
                  <Badge variant={isTracking ? "default" : "secondary"}>
                    {isTracking ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Update Frequency:</span>
                  <span className="font-medium">30s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Data Points:</span>
                  <span className="font-medium">{vehicles.length * totalUpdates}</span>
                </div>
              </CardContent>
            </Card>

            {/* Fleet Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Car className="w-5 h-5" />
                  <span>Fleet Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-sm">Moving</span>
                    </div>
                    <span className="font-medium">{movingVehicleCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-sm">Parked</span>
                    </div>
                    <span className="font-medium">{parkedVehicleCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      <span className="text-sm">Offline</span>
                    </div>
                    <span className="font-medium">{offlineVehicleCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <span>Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Active Rate:</span>
                  <span className="font-medium">
                    {vehicles.length > 0 ? Math.round((activeVehicleCount / vehicles.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Movement Rate:</span>
                  <span className="font-medium">
                    {activeVehicleCount > 0 ? Math.round((movingVehicleCount / activeVehicleCount) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Speed:</span>
                  <span className="font-medium">
                    {movingVehicles.length > 0 
                      ? Math.round(movingVehicles.reduce((sum, v) => sum + v.speed, 0) / movingVehicles.length)
                      : 0
                    } km/h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Data Freshness:</span>
                  <Badge variant="outline" className="text-xs">
                    {lastUpdate ? 'Fresh' : 'Stale'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};