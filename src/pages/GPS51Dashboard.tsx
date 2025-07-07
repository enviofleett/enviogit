
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Activity, Users, Truck, Zap, AlertTriangle } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';
import { useGPS51SessionBridge } from '@/hooks/useGPS51SessionBridge';

const GPS51Dashboard: React.FC = () => {
  const { vehicles, vehiclePositions, loading, error } = useGPS51Data();
  
  // Create mock metrics from GPS51 data
  const positions = vehiclePositions.map(pos => ({
    deviceid: pos.vehicle_id,
    callat: pos.latitude,
    callon: pos.longitude,
    speed: pos.speed,
    moving: pos.isMoving ? 1 : 0,
    strstatus: pos.status,
    updatetime: new Date(pos.timestamp).getTime() / 1000
  }));
  
  const metrics = {
    totalDevices: vehicles.length,
    activeDevices: vehicles.filter(v => v.latest_position).length,
    movingVehicles: vehiclePositions.filter(p => p.isMoving).length,
    parkedDevices: vehiclePositions.filter(p => !p.isMoving).length,
    offlineVehicles: vehicles.length - vehicles.filter(v => v.latest_position).length
  };
  const { status, connect, disconnect } = useGPS51SessionBridge();

  const handleConnect = async () => {
    // In a real implementation, these would come from a form or config
    const credentials = {
      username: 'demo',
      password: 'demo',
      apiKey: 'demo-key',
      apiUrl: 'https://api.gps51.com/webapi' // Added missing apiUrl property
    };
    await connect(credentials);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">GPS51 Fleet Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Badge variant={status.isConnected ? 'default' : 'destructive'}>
            {status.isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          {status.isConnected ? (
            <Button onClick={disconnect} variant="outline">
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect}>
              Connect to GPS51
            </Button>
          )}
        </div>
      </div>

      {/* Fleet Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDevices}</div>
            <p className="text-xs text-muted-foreground">
              Fleet size
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.activeDevices}</div>
            <p className="text-xs text-muted-foreground">
              Online and reporting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moving</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.movingVehicles}</div>
            <p className="text-xs text-muted-foreground">
              Currently in motion
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parked</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics.parkedDevices}</div>
            <p className="text-xs text-muted-foreground">
              Stationary vehicles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.offlineVehicles}</div>
            <p className="text-xs text-muted-foreground">
              Not reporting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Live Vehicle List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Live Vehicle Tracking</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading GPS51 data...</p>}
          {error && (
            <div className="text-red-600 p-4 bg-red-50 rounded-lg">
              Error: {error}
            </div>
          )}
          
          {!loading && !error && positions.length === 0 && (
            <p className="text-gray-500">No GPS51 devices found. Connect to GPS51 to see live data.</p>
          )}

          {positions.length > 0 && (
            <div className="space-y-4">
              {positions.slice(0, 10).map((position) => (
                <div key={position.deviceid} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${position.moving === 1 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                    <div>
                      <p className="font-medium">Device {position.deviceid}</p>
                      <p className="text-sm text-gray-500">
                        {position.callat.toFixed(6)}, {position.callon.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{Math.round(position.speed)} km/h</p>
                    <p className="text-sm text-gray-500">{position.strstatus}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51Dashboard;
