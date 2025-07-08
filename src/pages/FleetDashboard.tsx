/**
 * Modern Fleet Dashboard
 * Real-time vehicle tracking with interactive map and comprehensive fleet management
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Navigation, 
  Zap, 
  Fuel, 
  Thermometer,
  Clock,
  Users,
  TrendingUp,
  AlertTriangle,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RefreshCw,
  Car,
  Activity,
  Settings,
  Wrench
} from 'lucide-react';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';
import { useToast } from '@/hooks/use-toast';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { useNavigate } from 'react-router-dom';
import FleetMap from '@/components/fleet/FleetMap';
import VehicleDetailsPanel from '@/components/fleet/VehicleDetailsPanel';
import FleetMetricsCards from '@/components/fleet/FleetMetricsCards';
import RealTimeStatusPanel from '@/components/fleet/RealTimeStatusPanel';

const FleetDashboard: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [mapView, setMapView] = useState<'satellite' | 'street'>('street');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Use the refactored GPS51 live data hook - FORCE AUTO-START
  const {
    state: {
      vehicles,
      positions,
      isLoading,
      isPolling,
      error,
      authState,
      lastUpdate,
      pollingInterval
    },
    actions: {
      authenticate,
      startPolling,
      stopPolling,
      refreshData,
      logout,
      clearCaches,
      resetQueryTime
    },
    serviceStatus
  } = useGPS51LiveData({
    autoStart: true, // FORCE auto-start to bypass authentication barriers
    enableSmartPolling: true
  });

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh && authState.isAuthenticated && !isPolling) {
      startPolling();
    } else if (!autoRefresh && isPolling) {
      stopPolling();
    }
  }, [autoRefresh, authState.isAuthenticated]);

  // PRODUCTION FIX: Handle authentication using unified system
  const handleAuthenticate = async () => {
    try {
      // Check if configuration exists first
      if (!GPS51ConfigStorage.isConfigured()) {
        toast({
          title: "GPS51 Setup Required",
          description: "Redirecting to Settings to configure GPS51 credentials...",
          variant: "default"
        });
        // Redirect to settings page with GPS51 setup
        navigate('/settings?tab=gps51');
        return;
      }

      const config = GPS51ConfigStorage.getConfiguration();
      if (!config) {
        throw new Error('Failed to load GPS51 configuration');
      }

      await authenticate(config.username, config.password);
      toast({
        title: "Connected to GPS51",
        description: "Successfully authenticated and ready to track vehicles.",
      });
    } catch (error) {
      console.error('Fleet Dashboard authentication error:', error);
      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Failed to connect to GPS51",
        variant: "destructive"
      });
    }
  };

  // PRODUCTION FIX: Direct setup navigation
  const handleSetupGPS51 = () => {
    navigate('/settings?tab=gps51');
  };

  // Calculate fleet metrics
  const fleetMetrics = React.useMemo(() => {
    const total = vehicles.length;
    const moving = vehicles.filter(v => v.isMoving).length;
    const stationary = vehicles.filter(v => !v.isMoving && v.status !== 'offline').length;
    const offline = vehicles.filter(v => v.status === 'offline').length;
    const averageSpeed = vehicles.reduce((sum, v) => sum + v.speed, 0) / (total || 1);

    return {
      total,
      moving,
      stationary,
      offline,
      averageSpeed: Math.round(averageSpeed),
      utilization: Math.round((moving / (total || 1)) * 100),
      lastUpdate: lastUpdate?.toLocaleTimeString() || 'Never'
    };
  }, [vehicles, lastUpdate]);

  // Get vehicle by ID
  const getVehicleById = (vehicleId: string) => {
    return vehicles.find(v => v.deviceid === vehicleId);
  };

  // REMOVED: No more authentication barriers - always show dashboard

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Car className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Fleet Dashboard</h1>
                  <p className="text-sm text-gray-500">Real-time vehicle monitoring</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {authState.isAuthenticated ? (
                  <Badge variant="default" className="bg-green-100 text-green-700">
                    <Wifi className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Disconnected
                  </Badge>
                )}
              </div>
              
              {/* Auto Refresh Toggle */}
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Auto Refresh On
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Auto Refresh Off
                  </>
                )}
              </Button>
              
              {/* Manual Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Fleet Metrics */}
          <FleetMetricsCards metrics={fleetMetrics} />
          
          {/* Real-time Status */}
          <RealTimeStatusPanel 
            isPolling={isPolling}
            pollingInterval={pollingInterval}
            serviceStatus={serviceStatus}
            lastUpdate={lastUpdate}
          />

          {/* Main Dashboard */}
          <Tabs defaultValue="map" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="map">Live Map</TabsTrigger>
              <TabsTrigger value="vehicles">Vehicle List</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            {/* Live Map Tab */}
            <TabsContent value="map" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Map */}
                <div className="lg:col-span-3">
                  <Card className="h-[600px]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                          <MapPin className="w-5 h-5" />
                          <span>Live Fleet Map</span>
                        </CardTitle>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant={mapView === 'street' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMapView('street')}
                          >
                            Street
                          </Button>
                          <Button
                            variant={mapView === 'satellite' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setMapView('satellite')}
                          >
                            Satellite
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 h-[calc(100%-80px)]">
                      <FleetMap
                        vehicles={vehicles}
                        positions={positions}
                        selectedVehicle={selectedVehicle}
                        onVehicleSelect={setSelectedVehicle}
                        mapStyle={mapView}
                      />
                    </CardContent>
                  </Card>
                </div>
                
                {/* Vehicle Details Panel */}
                <div className="lg:col-span-1">
                  <VehicleDetailsPanel
                    vehicle={selectedVehicle ? getVehicleById(selectedVehicle) : null}
                    onClose={() => setSelectedVehicle(null)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Vehicle List Tab */}
            <TabsContent value="vehicles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Fleet Vehicles ({vehicles.length})</span>
                  </CardTitle>
                  <CardDescription>
                    Monitor all vehicles in your fleet with real-time status updates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                     {isLoading && vehicles.length === 0 ? (
                       <div className="text-center py-8 text-gray-500">
                         <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-300 animate-spin" />
                         <p>Loading vehicles...</p>
                         <p className="text-sm">Connecting to GPS51 and fetching fleet data</p>
                       </div>
                     ) : vehicles.length === 0 ? (
                       <div className="text-center py-8 text-gray-500">
                         <Car className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                         <p>No vehicles available</p>
                         <p className="text-sm">
                           {!authState.isAuthenticated ? 'Authenticating with GPS51...' : 'Fleet data will appear here once loaded'}
                         </p>
                       </div>
                     ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {vehicles.map((vehicle) => (
                          <Card 
                            key={vehicle.deviceid}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedVehicle === vehicle.deviceid ? 'ring-2 ring-blue-500' : ''
                            }`}
                            onClick={() => setSelectedVehicle(vehicle.deviceid)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-medium truncate">{vehicle.devicename}</h3>
                                <Badge 
                                  variant={
                                    vehicle.isMoving ? 'default' : 
                                    vehicle.status === 'offline' ? 'destructive' : 'secondary'
                                  }
                                >
                                  {vehicle.isMoving ? 'Moving' : 
                                   vehicle.status === 'offline' ? 'Offline' : 'Parked'}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center space-x-2">
                                  <Navigation className="w-4 h-4 text-gray-400" />
                                  <span>{vehicle.speed} km/h</span>
                                </div>
                                
                                {vehicle.position && (
                                  <>
                                    <div className="flex items-center space-x-2">
                                      <MapPin className="w-4 h-4 text-gray-400" />
                                      <span className="truncate">
                                        {vehicle.position.callat.toFixed(4)}, {vehicle.position.callon.toFixed(4)}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <Clock className="w-4 h-4 text-gray-400" />
                                      <span>{vehicle.lastUpdate.toLocaleTimeString()}</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="w-5 h-5" />
                      <span>Fleet Utilization</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Active Vehicles</span>
                          <span>{fleetMetrics.utilization}%</span>
                        </div>
                        <Progress value={fleetMetrics.utilization} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Moving</p>
                          <p className="text-lg font-semibold text-green-600">{fleetMetrics.moving}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Parked</p>
                          <p className="text-lg font-semibold text-blue-600">{fleetMetrics.stationary}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Navigation className="w-5 h-5" />
                      <span>Average Speed</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {fleetMetrics.averageSpeed} km/h
                    </div>
                    <p className="text-sm text-gray-500">
                      Fleet average across all active vehicles
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="w-5 h-5" />
                      <span>System Status</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Polling Interval</span>
                        <Badge variant="outline">{Math.round(pollingInterval / 1000)}s</Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Last Update</span>
                        <span className="text-sm text-gray-500">{fleetMetrics.lastUpdate}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Status</span>
                        <Badge variant={isPolling ? 'default' : 'secondary'}>
                          {isPolling ? 'Live' : 'Paused'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Alerts Tab */}
            <TabsContent value="alerts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>System Alerts</span>
                  </CardTitle>
                  <CardDescription>
                    Monitor system health and vehicle alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {error ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          <span className="font-medium text-red-900">System Error</span>
                        </div>
                        <p className="text-sm text-red-700 mt-2">{error}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Wifi className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-900">System Healthy</span>
                        </div>
                        <p className="text-sm text-green-700 mt-2">
                          All systems operational. Real-time data is flowing normally.
                        </p>
                      </div>
                    )}
                    
                    {/* Offline vehicles alert */}
                    {fleetMetrics.offline > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <WifiOff className="w-5 h-5 text-yellow-600" />
                          <span className="font-medium text-yellow-900">
                            {fleetMetrics.offline} Vehicle(s) Offline
                          </span>
                        </div>
                        <p className="text-sm text-yellow-700 mt-2">
                          Some vehicles are not reporting location data. Check device connectivity.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default FleetDashboard;