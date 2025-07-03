import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Activity, MapPin, Wifi, WifiOff, Users, Car, Navigation, Zap } from 'lucide-react';
import { useGPS51DirectAuth } from '@/hooks/useGPS51DirectAuth';
import { useGPS51DirectVehicles } from '@/hooks/useGPS51DirectVehicles';
import { useGPS51DirectPositions } from '@/hooks/useGPS51DirectPositions';
import { useGPS51DirectConnection } from '@/hooks/useGPS51DirectConnection';
import { useGPS51SmartPolling } from '@/hooks/useGPS51SmartPolling';
import { useGPS51MetricsTracker } from '@/hooks/useGPS51MetricsTracker';
import { GPS51DirectVehicleTable } from './GPS51DirectVehicleTable';
import { GPS51DirectStatusCards } from './GPS51DirectStatusCards';
import { GPS51DirectMapView } from './GPS51DirectMapView';

export const GPS51DirectDashboard: React.FC = () => {
  const auth = useGPS51DirectAuth();
  const vehicles = useGPS51DirectVehicles({ autoRefresh: true });
  const positions = useGPS51DirectPositions({ autoStart: false });
  const connection = useGPS51DirectConnection({ autoStart: true });
  const smartPolling = useGPS51SmartPolling();
  const metrics = useGPS51MetricsTracker();

  // Auto-start smart polling when vehicles are loaded
  React.useEffect(() => {
    if (vehicles.hasVehicles && !smartPolling.state.isActive) {
      const deviceIds = vehicles.state.vehicles.map(v => v.deviceid);
      smartPolling.startSmartPolling(deviceIds);
    }
  }, [vehicles.hasVehicles, vehicles.state.vehicles, smartPolling]);

  // Show login prompt if not authenticated
  if (!auth.isReady && !auth.state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>GPS51 Direct Dashboard</CardTitle>
            <CardDescription>
              Please authenticate to access your vehicle tracking dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/settings'} 
              className="w-full"
            >
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state
  if (auth.state.isLoading || vehicles.state.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground">Loading dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (auth.hasError || vehicles.state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-destructive">Dashboard Error</CardTitle>
            <CardDescription>
              {auth.state.error || vehicles.state.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={() => {
                auth.actions.clearError();
                vehicles.actions.clearError();
                vehicles.actions.refresh(true);
              }}
              className="w-full"
              variant="outline"
            >
              Retry
            </Button>
            <Button 
              onClick={() => window.location.href = '/settings'} 
              className="w-full"
            >
              Check Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metricsSnapshot = metrics.getSnapshot();
  const connectionStatus = connection.state.status;
  const isPollingActive = smartPolling.state.isActive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">GPS51 Direct</h1>
                  <p className="text-xs text-muted-foreground">Real-time Vehicle Tracking</p>
                </div>
              </div>
              
              <Separator orientation="vertical" className="h-8" />
              
              <div className="flex items-center space-x-3">
                {/* Connection Status */}
                <div className="flex items-center space-x-1">
                  {connection.isConnected ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <Badge 
                    variant={connection.isConnected ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {connectionStatus}
                  </Badge>
                </div>

                {/* Polling Status */}
                <div className="flex items-center space-x-1">
                  <Activity className={`w-4 h-4 ${isPollingActive ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                  <Badge variant={isPollingActive ? "default" : "secondary"} className="text-xs">
                    {isPollingActive ? 'Live' : 'Paused'}
                  </Badge>
                </div>

                {/* Vehicle Count */}
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{vehicles.state.vehicles.length}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isPollingActive) {
                    smartPolling.stopSmartPolling();
                  } else {
                    const deviceIds = vehicles.state.vehicles.map(v => v.deviceid);
                    smartPolling.startSmartPolling(deviceIds);
                  }
                }}
              >
                <Zap className="w-4 h-4 mr-1" />
                {isPollingActive ? 'Pause' : 'Start'} Live Tracking
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => vehicles.actions.refresh(true)}
                disabled={vehicles.state.isRefreshing}
              >
                {vehicles.state.isRefreshing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Activity className="w-4 h-4 mr-1" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Cards */}
        <GPS51DirectStatusCards 
          vehicles={vehicles.state.vehicles}
          positions={positions.state.positions}
          connection={connection.state}
          smartPolling={smartPolling.state}
          metrics={metricsSnapshot}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Vehicle Table - Takes 2 columns on xl screens */}
          <div className="xl:col-span-2">
            <GPS51DirectVehicleTable 
              vehicles={vehicles.state.vehicles}
              positions={positions.state.positions}
              isLoading={vehicles.state.isLoading}
              onVehicleSelect={(vehicleId) => {
                // Handle vehicle selection for map focus
                console.log('Vehicle selected:', vehicleId);
              }}
            />
          </div>

          {/* Map View - Takes 1 column on xl screens */}
          <div>
            <GPS51DirectMapView
              vehicles={vehicles.state.vehicles}
              positions={positions.state.positions}
              isLiveTracking={isPollingActive}
              className="h-[600px]"
            />
          </div>
        </div>

        {/* System Status Footer */}
        <Card className="bg-muted/30 border-muted">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{metricsSnapshot.performance.totalRequests}</div>
                <div className="text-xs text-muted-foreground">API Requests</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{metricsSnapshot.performance.successRate}%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{metricsSnapshot.performance.averageResponseTime}ms</div>
                <div className="text-xs text-muted-foreground">Avg Response</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{Math.round(metricsSnapshot.system.uptime / 60000)}m</div>
                <div className="text-xs text-muted-foreground">Uptime</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};