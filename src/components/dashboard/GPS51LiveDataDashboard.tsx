
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Navigation, 
  Fuel, 
  Thermometer, 
  Battery, 
  AlertTriangle, 
  Wifi,
  WifiOff,
  Clock,
  Gauge,
  Activity
} from 'lucide-react';
import { useGPS51LiveDataEnhanced } from '@/hooks/useGPS51LiveDataEnhanced';

const GPS51LiveDataDashboard: React.FC = () => {
  const { 
    metrics, 
    vehicles, 
    loading, 
    error, 
    refresh,
    liveData 
  } = useGPS51LiveDataEnhanced({
    enabled: true,
    pollingInterval: 30000,
    autoStart: true
  });

  const getStatusBadge = (freshness: string) => {
    switch (freshness) {
      case 'live':
        return <Badge className="bg-green-100 text-green-800">Live</Badge>;
      case 'stale':
        return <Badge className="bg-yellow-100 text-yellow-800">Stale</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  if (loading && vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading live GPS51 data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            GPS51 Live Data Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fleet Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vehicles</p>
                <p className="text-2xl font-bold">{metrics.totalDevices}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Now</p>
                <p className="text-2xl font-bold text-green-600">{metrics.activeDevices}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Moving</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.movingVehicles}</p>
              </div>
              <Navigation className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Alerts</p>
                <p className="text-2xl font-bold text-orange-600">
                  {metrics.devicesWithAlarms + metrics.fuelAlerts + metrics.temperatureAlerts}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Live Data Status
            </span>
            {getStatusBadge(metrics.dataFreshness)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Last Update:</span>
              <p className="font-medium">{formatLastUpdate(metrics.lastUpdateTime)}</p>
            </div>
            <div>
              <span className="text-gray-600">Avg Speed:</span>
              <p className="font-medium">{metrics.averageSpeed} km/h</p>
            </div>
            <div>
              <span className="text-gray-600">Total Distance:</span>
              <p className="font-medium">{metrics.totalDistance} km</p>
            </div>
            <div>
              <span className="text-gray-600">Query Time:</span>
              <p className="font-medium">{liveData.lastQueryPositionTime}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Vehicle Data</span>
            <button
              onClick={refresh}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {vehicles.map((vehicleData) => (
              <div
                key={vehicleData.device.deviceid}
                className={`p-4 rounded-lg border ${
                  vehicleData.isOnline 
                    ? 'border-green-200 bg-green-50/30' 
                    : 'border-gray-200 bg-gray-50/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      vehicleData.isMoving 
                        ? 'bg-green-500 animate-pulse' 
                        : vehicleData.isOnline 
                          ? 'bg-yellow-500' 
                          : 'bg-gray-400'
                    }`} />
                    {vehicleData.isOnline ? (
                      <Wifi className="w-4 h-4 text-green-600" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">{vehicleData.device.devicename}</p>
                      <p className="text-sm text-gray-500">ID: {vehicleData.device.deviceid}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {vehicleData.hasAlarms && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    <Badge variant={vehicleData.isOnline ? "default" : "secondary"}>
                      {vehicleData.isMoving ? 'Moving' : vehicleData.isOnline ? 'Parked' : 'Offline'}
                    </Badge>
                  </div>
                </div>

                {vehicleData.position && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Navigation className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="text-gray-600">Speed:</span>
                        <p className="font-medium">{Math.round(vehicleData.position.speed)} km/h</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="text-gray-600">Position:</span>
                        <p className="font-mono text-xs">
                          {vehicleData.position.callat.toFixed(4)}, {vehicleData.position.callon.toFixed(4)}
                        </p>
                      </div>
                    </div>

                    {vehicleData.fuelLevel !== undefined && (
                      <div className="flex items-center space-x-2">
                        <Fuel className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-600">Fuel:</span>
                          <div className="flex items-center space-x-1">
                            <Progress value={vehicleData.fuelLevel} className="w-12 h-2" />
                            <span className="text-xs">{vehicleData.fuelLevel}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {vehicleData.temperature !== undefined && (
                      <div className="flex items-center space-x-2">
                        <Thermometer className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-600">Temp:</span>
                          <p className="font-medium">{vehicleData.temperature}°C</p>
                        </div>
                      </div>
                    )}

                    {vehicleData.batteryLevel !== undefined && (
                      <div className="flex items-center space-x-2">
                        <Battery className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-gray-600">Battery:</span>
                          <p className="font-medium">{vehicleData.batteryLevel}%</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Gauge className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="text-gray-600">Distance:</span>
                        <p className="font-medium">{Math.round((vehicleData.position.totaldistance || 0) / 1000)} km</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <span className="text-gray-600">Last Seen:</span>
                        <p className="font-medium">{formatLastUpdate(vehicleData.lastSeen)}</p>
                      </div>
                    </div>

                    {vehicleData.position.strstatus && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Status:</span>
                        <p className="font-medium text-sm">{vehicleData.position.strstatus}</p>
                      </div>
                    )}
                  </div>
                )}

                {vehicleData.hasAlarms && vehicleData.position?.stralarm && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-red-800">Active Alarm:</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">{vehicleData.position.stralarm}</p>
                  </div>
                )}
              </div>
            ))}

            {vehicles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No vehicle data available</p>
                <button
                  onClick={refresh}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Load Data
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51LiveDataDashboard;
