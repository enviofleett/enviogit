
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Wifi, Users, MapPin, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useGPS51LiveSync } from '@/hooks/useGPS51LiveSync';
import { supabase } from '@/integrations/supabase/client';

interface VehiclePosition {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  ignition_status: boolean;
  fuel_level: number | null;
  address: string | null;
  vehicle: {
    license_plate: string;
    brand: string;
    model: string;
    status: string;
  };
}

const GPS51LiveDashboard: React.FC = () => {
  const { status, forceSync, isRunning } = useGPS51LiveSync(true, 30000); // Sync every 30 seconds
  const [livePositions, setLivePositions] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest vehicle positions
  const fetchLivePositions = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_positions')
        .select(`
          id,
          vehicle_id,
          latitude,
          longitude,
          speed,
          heading,
          timestamp,
          ignition_status,
          fuel_level,
          address,
          vehicles!vehicle_positions_vehicle_id_fkey (
            license_plate,
            brand,
            model,
            status
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching live positions:', error);
        return;
      }

      // Transform the data to match our interface
      const transformedData = data?.map(item => ({
        ...item,
        vehicle: item.vehicles as any // Cast to match our interface
      })) || [];

      setLivePositions(transformedData);
    } catch (error) {
      console.error('Failed to fetch live positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLivePositions();
    
    // Refresh positions when sync completes
    const interval = setInterval(fetchLivePositions, 30000);
    return () => clearInterval(interval);
  }, [status.lastSync]);

  const getStatusBadge = () => {
    if (status.isConnected && status.isActive) {
      return <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Live & Active
      </Badge>;
    } else if (status.errors.length > 0) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Error
      </Badge>;
    } else {
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        Connecting...
      </Badge>;
    }
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
  };

  const getActiveVehicles = () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return livePositions.filter(pos => new Date(pos.timestamp) > fiveMinutesAgo).length;
  };

  const getMovingVehicles = () => {
    return livePositions.filter(pos => pos.ignition_status || pos.speed > 0).length;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading GPS51 live data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              GPS51 Live Data Stream
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button
                onClick={forceSync}
                disabled={isRunning}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Vehicles</p>
                <p className="text-2xl font-bold">{status.devicesFound.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Wifi className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Active (5min)</p>
                <p className="text-2xl font-bold">{getActiveVehicles().toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Moving Now</p>
                <p className="text-2xl font-bold">{getMovingVehicles().toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <Activity className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Last Sync</p>
                <p className="text-lg font-bold">{formatLastSync(status.lastSync)}</p>
              </div>
            </div>
          </div>

          {/* Sync Performance */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span>Last sync: {status.positionsStored} positions stored in {status.executionTime}ms</span>
              {status.errors.length > 0 && (
                <span className="text-red-600">{status.errors.length} errors</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {status.errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              GPS51 Sync Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.errors.slice(0, 5).map((error, index) => (
                <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              ))}
              {status.errors.length > 5 && (
                <p className="text-sm text-gray-600">
                  ... and {status.errors.length - 5} more errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Vehicle Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Vehicle Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {livePositions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No live positions available</p>
              <p className="text-sm">Make sure GPS51 devices are active and sending data</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {livePositions.slice(0, 20).map((position) => (
                <div key={position.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      position.ignition_status ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium">{position.vehicle?.license_plate}</p>
                      <p className="text-sm text-gray-600">
                        {position.vehicle?.brand} {position.vehicle?.model}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{position.speed} km/h</p>
                    <p className="text-xs text-gray-500">
                      {new Date(position.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={position.vehicle?.status === 'assigned' ? 'default' : 'secondary'}>
                      {position.vehicle?.status}
                    </Badge>
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

export default GPS51LiveDashboard;
