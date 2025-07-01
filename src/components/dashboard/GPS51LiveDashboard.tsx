import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Wifi, Users, MapPin, RefreshCw, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { useGPS51LiveSync } from '@/hooks/useGPS51LiveSync';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

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
  const [isConfigured, setIsConfigured] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);
  
  // Only initialize sync if GPS51 is configured
  const { status, forceSync, isRunning } = useGPS51LiveSync(isConfigured, 30000);
  const [livePositions, setLivePositions] = useState<VehiclePosition[]>([]);
  const [loading, setLoading] = useState(false);

  // Check GPS51 configuration status
  useEffect(() => {
    const checkGPS51Configuration = async () => {
      try {
        setCheckingConfig(true);
        
        // Check if GPS51 credentials are stored locally
        const apiUrl = localStorage.getItem('gps51_api_url');
        const username = localStorage.getItem('gps51_username');
        const passwordHash = localStorage.getItem('gps51_password_hash');
        
        if (!apiUrl || !username || !passwordHash) {
          setIsConfigured(false);
          setConfigurationError('GPS51 credentials not configured');
          return;
        }

        // Try to test the connection
        try {
          const { data, error } = await supabase.functions.invoke('gps51-auth', {
            body: { 
              action: 'test',
              apiUrl,
              username,
              password: passwordHash
            }
          });

          if (error) {
            setIsConfigured(false);
            setConfigurationError(`Connection test failed: ${error.message}`);
          } else if (data?.success) {
            setIsConfigured(true);
            setConfigurationError(null);
          } else {
            setIsConfigured(false);
            setConfigurationError(data?.error || 'Authentication failed');
          }
        } catch (testError) {
          console.warn('GPS51 connection test failed:', testError);
          setIsConfigured(false);
          setConfigurationError('Unable to test GPS51 connection');
        }
      } catch (error) {
        console.error('Error checking GPS51 configuration:', error);
        setIsConfigured(false);
        setConfigurationError('Configuration check failed');
      } finally {
        setCheckingConfig(false);
      }
    };

    checkGPS51Configuration();
  }, []);

  // Fetch latest vehicle positions only if configured
  const fetchLivePositions = async () => {
    if (!isConfigured) return;
    
    try {
      setLoading(true);
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

      const transformedData = data?.map(item => ({
        ...item,
        vehicle: item.vehicles as any
      })) || [];

      setLivePositions(transformedData);
    } catch (error) {
      console.error('Failed to fetch live positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConfigured) {
      fetchLivePositions();
      const interval = setInterval(fetchLivePositions, 30000);
      return () => clearInterval(interval);
    }
  }, [isConfigured, status.lastSync]);

  // Show configuration check loading
  if (checkingConfig) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Checking GPS51 configuration...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show configuration required state
  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Settings className="h-5 w-5" />
              GPS51 Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">GPS51 Not Configured</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {configurationError || 'GPS51 API credentials are required to display live vehicle data.'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-gray-600">To get started with GPS51 live tracking:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 ml-4">
                <li>Go to Settings and configure your GPS51 API credentials</li>
                <li>Enter your GPS51 API URL, username, and password</li>
                <li>Test the connection to ensure it's working</li>
                <li>Return here to view live vehicle data</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure GPS51
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Check
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
