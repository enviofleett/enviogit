import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  Gauge,
  Fuel,
  Thermometer,
  Power,
  AlertTriangle,
  Car,
  TrendingUp,
  BarChart3,
  Settings
} from 'lucide-react';
import { useGPS51LiveTracking } from '@/hooks/useGPS51LiveTracking';
import { VehicleSpeedometer } from './VehicleSpeedometer';
import { LiveFuelTracker } from './LiveFuelTracker';
import { EngineMonitor } from './EngineMonitor';
import { IgnitionStatus } from './IgnitionStatus';

export const LiveFleetMonitoringPanel: React.FC = () => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'detailed'>('grid');

  const {
    vehicles,
    isTracking,
    isLoading,
    error,
    lastUpdate,
    activeVehicleCount,
    movingVehicleCount,
    startTracking,
    stopTracking,
    refreshNow,
    movingVehicles,
    parkedVehicles
  } = useGPS51LiveTracking({
    autoStart: true,
    baseInterval: 15000, // 15 seconds for monitoring panel
    adaptiveRefresh: true
  });

  // Mock additional vehicle data (in real implementation, this would come from GPS51)
  const enhanceVehicleData = (vehicle: any) => {
    const position = vehicle.position;
    const speed = position?.speed || 0;
    const isMoving = vehicle.isMoving;
    
    return {
      ...vehicle,
      // Mock fuel data (normally from GPS51 sensors)
      fuelLevel: Math.max(10, Math.random() * 100), // 10-100%
      fuelConsumptionRate: isMoving ? 6 + Math.random() * 8 : 0, // 6-14 L/100km when moving
      estimatedRange: Math.floor(Math.random() * 400 + 100), // 100-500 km
      tankCapacity: 50,
      
      // Mock engine data
      engineTemperature: isMoving ? 85 + Math.random() * 20 : 20 + Math.random() * 10, // 85-105°C when running
      oilPressure: isMoving ? 25 + Math.random() * 15 : 0, // 25-40 PSI when running
      coolantLevel: 80 + Math.random() * 20, // 80-100%
      
      // Mock ignition data
      ignitionState: isMoving ? 'on' : Math.random() > 0.8 ? 'accessory' : 'off',
      doorsLocked: Math.random() > 0.3, // 70% chance locked
      engineRunTime: isMoving ? Math.floor(Math.random() * 300) : 0, // 0-300 minutes
      batteryVoltage: 12.0 + Math.random() * 1.0, // 12.0-13.0V
      lastIgnitionChange: Date.now() - Math.random() * 3600000 // last hour
    };
  };

  const enhancedVehicles = vehicles.map(enhanceVehicleData);

  // Get critical alerts
  const getCriticalAlerts = () => {
    const alerts = [];
    
    enhancedVehicles.forEach(vehicle => {
      if (vehicle.fuelLevel < 15) {
        alerts.push({
          vehicleId: vehicle.device.deviceid,
          vehicleName: vehicle.device.devicename,
          type: 'fuel',
          severity: vehicle.fuelLevel < 10 ? 'critical' : 'warning',
          message: `Low fuel: ${vehicle.fuelLevel.toFixed(1)}%`
        });
      }
      
      if (vehicle.engineTemperature > 105) {
        alerts.push({
          vehicleId: vehicle.device.deviceid,
          vehicleName: vehicle.device.devicename,
          type: 'temperature',
          severity: 'critical',
          message: `Engine overheating: ${vehicle.engineTemperature.toFixed(1)}°C`
        });
      }
      
      if (vehicle.batteryVoltage < 12.0) {
        alerts.push({
          vehicleId: vehicle.device.deviceid,
          vehicleName: vehicle.device.devicename,
          type: 'battery',
          severity: 'warning',
          message: `Low battery: ${vehicle.batteryVoltage.toFixed(1)}V`
        });
      }
    });
    
    return alerts;
  };

  const criticalAlerts = getCriticalAlerts();

  // Filter vehicles for display
  const displayVehicles = selectedVehicleId 
    ? enhancedVehicles.filter(v => v.device.deviceid === selectedVehicleId)
    : enhancedVehicles.slice(0, 8); // Show max 8 for grid view

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Activity className="w-6 h-6" />
            <span>Live Fleet Monitoring</span>
            {isTracking && (
              <Badge variant="default" className="ml-2 animate-pulse">
                Live
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Real-time vehicle health and performance monitoring
            {criticalAlerts.length > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                • {criticalAlerts.length} alert{criticalAlerts.length !== 1 ? 's' : ''} active
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid View
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('detailed')}
          >
            Detailed View
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNow}
            disabled={isLoading}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Critical Alerts Detected</span>
            </div>
            <div className="space-y-1">
              {criticalAlerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="text-sm">
                  <strong>{alert.vehicleName}:</strong> {alert.message}
                </div>
              ))}
              {criticalAlerts.length > 3 && (
                <div className="text-sm text-red-500">
                  +{criticalAlerts.length - 3} more alerts
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Car className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{vehicles.length}</div>
                <p className="text-sm text-muted-foreground">Total Vehicles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{movingVehicleCount}</div>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{criticalAlerts.length}</div>
                <p className="text-sm text-muted-foreground">Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold">
                  {movingVehicles.length > 0 
                    ? Math.round(movingVehicles.reduce((sum, v) => sum + v.speed, 0) / movingVehicles.length)
                    : 0
                  }
                </div>
                <p className="text-sm text-muted-foreground">Avg Speed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Overview Tab - Speed Monitoring */}
        <TabsContent value="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Vehicle Speed Monitoring</h3>
            <Badge variant="outline">{displayVehicles.length} vehicles shown</Badge>
          </div>
          
          {displayVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No vehicle data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayVehicles.map((vehicle) => (
                <VehicleSpeedometer
                  key={vehicle.device.deviceid}
                  vehicleId={vehicle.device.deviceid}
                  vehicleName={vehicle.device.devicename || vehicle.device.deviceid}
                  currentSpeed={vehicle.speed}
                  maxSpeed={120}
                  speedLimit={80}
                  isMoving={vehicle.isMoving}
                  lastUpdate={vehicle.lastUpdate}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab - Fuel Tracking */}
        <TabsContent value="performance" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Fuel Consumption Tracking</h3>
            <Badge variant="outline">{displayVehicles.length} vehicles shown</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayVehicles.map((vehicle) => (
              <LiveFuelTracker
                key={vehicle.device.deviceid}
                vehicleId={vehicle.device.deviceid}
                vehicleName={vehicle.device.devicename || vehicle.device.deviceid}
                currentFuelLevel={vehicle.fuelLevel}
                fuelConsumptionRate={vehicle.fuelConsumptionRate}
                estimatedRange={vehicle.estimatedRange}
                isMoving={vehicle.isMoving}
                lastUpdate={vehicle.lastUpdate}
                tankCapacity={vehicle.tankCapacity}
              />
            ))}
          </div>
        </TabsContent>

        {/* Health Tab - Engine Monitoring */}
        <TabsContent value="health" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Engine Health Monitoring</h3>
            <Badge variant="outline">{displayVehicles.length} vehicles shown</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayVehicles.map((vehicle) => (
              <EngineMonitor
                key={vehicle.device.deviceid}
                vehicleId={vehicle.device.deviceid}
                vehicleName={vehicle.device.devicename || vehicle.device.deviceid}
                engineTemperature={vehicle.engineTemperature}
                oilPressure={vehicle.oilPressure}
                coolantLevel={vehicle.coolantLevel}
                isEngineOn={vehicle.ignitionState === 'on'}
                lastUpdate={vehicle.lastUpdate}
                normalTempRange={[85, 105]}
              />
            ))}
          </div>
        </TabsContent>

        {/* Security Tab - Ignition & Security */}
        <TabsContent value="security" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ignition & Security Status</h3>
            <Badge variant="outline">{displayVehicles.length} vehicles shown</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayVehicles.map((vehicle) => (
              <IgnitionStatus
                key={vehicle.device.deviceid}
                vehicleId={vehicle.device.deviceid}
                vehicleName={vehicle.device.devicename || vehicle.device.deviceid}
                isEngineOn={vehicle.ignitionState === 'on'}
                ignitionState={vehicle.ignitionState}
                doorsLocked={vehicle.doorsLocked}
                engineRunTime={vehicle.engineRunTime}
                lastIgnitionChange={vehicle.lastIgnitionChange}
                batteryVoltage={vehicle.batteryVoltage}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};