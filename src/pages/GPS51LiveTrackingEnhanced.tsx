
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import { Activity, Car, Navigation, Zap, RefreshCw, MapPin, Clock } from 'lucide-react';

const GPS51LiveTrackingEnhanced = () => {
  const { 
    positions, 
    metrics, 
    loading, 
    error, 
    lastSyncTime, 
    refresh,
    scalingMetrics,
    budgetStatus,
    optimizationInsights
  } = useGPS51LiveData({
    enabled: true,
    refreshInterval: 30000,
    enableWebSocket: true,
    enableIntelligentFiltering: true
  });

  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const handleRefresh = () => {
    refresh();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (moving: number) => {
    return moving === 1 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading GPS51 data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <h3 className="font-semibold">Connection Error</h3>
        <p>{error}</p>
        <Button onClick={handleRefresh} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GPS51 Live Tracking</h1>
          <p className="text-muted-foreground">
            Enhanced real-time vehicle tracking with Phase 5 optimizations
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Enhanced Fleet Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.vehiclesWithGPS} with GPS, {metrics.vehiclesWithoutGPS} without
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeDevices}</div>
            <p className="text-xs text-muted-foreground">
              Recently reported (last 5 min)
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
              Avg speed: {metrics.averageSpeed} km/h
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
              Stationary with GPS signal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Real-time GPS51 API connection and data synchronization status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Real-time Connection:</span>
                <Badge variant={metrics.realTimeConnected ? "default" : "destructive"}>
                  {metrics.realTimeConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Offline Vehicles:</span>
                <span className="font-medium">{metrics.offlineVehicles}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Update:</span>
                <span className="text-sm">{lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Total Distance:</span>
                <span className="font-medium">{(metrics.totalDistance / 1000).toFixed(1)} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Response Time:</span>
                <span className="text-sm">{scalingMetrics?.averageResponseTime || 0}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span>API Calls/min:</span>
                <span className="text-sm">{scalingMetrics?.apiCallsPerMinute || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Positions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Live Vehicle Positions
          </CardTitle>
          <CardDescription>
            Real-time GPS positions from GPS51 devices ({positions.length} vehicles)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {positions.map((position) => (
              <div 
                key={position.deviceid} 
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedVehicle === position.deviceid 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedVehicle(
                  selectedVehicle === position.deviceid ? null : position.deviceid
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div>
                      <div className="font-medium">{position.deviceid}</div>
                      <div className="text-sm text-gray-600">
                        {position.callat.toFixed(6)}, {position.callon.toFixed(6)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-sm font-medium">{position.speed} km/h</div>
                      <div className="text-xs text-gray-500">
                        {formatTime(position.updatetime)}
                      </div>
                    </div>
                    <Badge className={getStatusColor(position.moving)}>
                      {position.moving ? 'Moving' : 'Stopped'}
                    </Badge>
                  </div>
                </div>
                
                {selectedVehicle === position.deviceid && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Course:</span> {position.course}°
                      </div>
                      <div>
                        <span className="font-medium">Altitude:</span> {position.altitude}m
                      </div>
                      <div>
                        <span className="font-medium">Status:</span> {position.strstatus}
                      </div>
                      <div>
                        <span className="font-medium">Accuracy:</span> {position.radius}m
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {positions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No vehicle positions available</p>
                <p className="text-sm">Check your GPS51 connection and device status</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Insights */}
      {optimizationInsights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Performance Insights
            </CardTitle>
            <CardDescription>
              System optimization recommendations and metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(optimizationInsights).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GPS51LiveTrackingEnhanced;
