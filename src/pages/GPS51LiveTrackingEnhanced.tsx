
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import { Activity, Car, Navigation, MapPin, Clock, Zap, RefreshCw } from 'lucide-react';

const GPS51LiveTrackingEnhanced = () => {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { 
    positions, 
    metrics, 
    loading, 
    error, 
    lastSyncTime,
    refresh,
    triggerPrioritySync,
    intelligentFiltering,
    scalingMetrics,
    budgetStatus,
    optimizationInsights
  } = useGPS51LiveData({
    enabled: true,
    refreshInterval: autoRefresh ? 15000 : 60000, // 15s if auto-refresh, 1min otherwise
    enableWebSocket: true,
    enableIntelligentFiltering: true
  });

  const handleManualRefresh = useCallback(() => {
    console.log('Manual refresh triggered');
    refresh();
  }, [refresh]);

  const handlePrioritySync = useCallback((vehicleId: string) => {
    console.log('Priority sync triggered for:', vehicleId);
    triggerPrioritySync([vehicleId]);
  }, [triggerPrioritySync]);

  // Auto-refresh toggle
  useEffect(() => {
    if (autoRefresh) {
      console.log('Auto-refresh enabled');
    } else {
      console.log('Auto-refresh disabled');
    }
  }, [autoRefresh]);

  if (loading && positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading GPS51 live data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <h3 className="font-semibold">Connection Error</h3>
        <p>{error}</p>
        <Button onClick={handleManualRefresh} className="mt-2" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const selectedPosition = selectedVehicle 
    ? positions.find(p => p.deviceid === selectedVehicle)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GPS51 Live Tracking</h1>
          <p className="text-muted-foreground">
            Enhanced real-time vehicle tracking with intelligent filtering and optimization
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={handleManualRefresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fleet</CardTitle>
            <Car className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{metrics.totalDevices}</div>
            <p className="text-xs text-blue-600">
              {metrics.vehiclesWithGPS} GPS-enabled
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{metrics.activeDevices}</div>
            <p className="text-xs text-green-600">
              Last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Motion</CardTitle>
            <Navigation className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{metrics.movingVehicles}</div>
            <p className="text-xs text-orange-600">
              Currently moving
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parked</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{metrics.parkedDevices}</div>
            <p className="text-xs text-purple-600">
              Stationary
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Status & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>GPS51 API:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  metrics.realTimeConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {metrics.realTimeConnected ? '● Connected' : '● Disconnected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Offline Vehicles:</span>
                <span className="font-medium">{metrics.offlineVehicles}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Sync:</span>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-3 w-3 mr-1" />
                  {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Performance */}
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scalingMetrics && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Response Time:</span>
                    <span className="font-medium">{scalingMetrics.averageResponseTime}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Error Rate:</span>
                    <span className="font-medium">{(scalingMetrics.errorRate * 100).toFixed(1)}%</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span>Active Positions:</span>
                <span className="font-medium">{positions.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Vehicle Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Live Vehicle Positions</CardTitle>
          <CardDescription>
            Real-time GPS tracking data with intelligent filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {positions.map((position) => (
              <div 
                key={position.deviceid} 
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedVehicle === position.deviceid 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedVehicle(
                  selectedVehicle === position.deviceid ? null : position.deviceid
                )}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className="font-medium">{position.deviceid}</div>
                    <div className={`ml-2 px-2 py-1 rounded text-xs ${
                      position.moving 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {position.moving ? '● Moving' : '● Stopped'}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {position.callat.toFixed(6)}, {position.callon.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {position.strstatus || 'No status available'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{position.speed} km/h</div>
                  <div className="text-xs text-gray-500">
                    {new Date(position.updatetime).toLocaleTimeString()}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrioritySync(position.deviceid);
                    }}
                    className="mt-1"
                  >
                    Priority Sync
                  </Button>
                </div>
              </div>
            ))}
            {positions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No live vehicle positions available</p>
                <p className="text-sm">Check your GPS51 connection and try refreshing</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Vehicle Details */}
      {selectedPosition && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Details: {selectedPosition.deviceid}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Latitude</div>
                <div className="font-medium">{selectedPosition.callat.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Longitude</div>
                <div className="font-medium">{selectedPosition.callon.toFixed(6)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Speed</div>
                <div className="font-medium">{selectedPosition.speed} km/h</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Direction</div>
                <div className="font-medium">{selectedPosition.course}°</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Altitude</div>
                <div className="font-medium">{selectedPosition.altitude}m</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Accuracy</div>
                <div className="font-medium">{selectedPosition.radius}m</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="font-medium">{selectedPosition.strstatus}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Last Update</div>
                <div className="font-medium">
                  {new Date(selectedPosition.updatetime).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 bg-blue-100 border border-blue-200 rounded-lg p-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-blue-700">Syncing live data...</span>
        </div>
      )}
    </div>
  );
};

export default GPS51LiveTrackingEnhanced;
