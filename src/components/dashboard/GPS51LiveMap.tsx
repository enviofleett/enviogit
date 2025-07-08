import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  MapPin, 
  Navigation, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Map, 
  Play, 
  Pause,
  Car,
  Clock,
  Activity,
  Zap
} from 'lucide-react';
import { useGPS51LiveTracking } from '@/hooks/useGPS51LiveTracking';
import type { LiveVehicleData } from '@/hooks/useGPS51LiveTracking';

interface GPS51LiveMapProps {
  className?: string;
  autoStart?: boolean;
  refreshInterval?: number;
}

export const GPS51LiveMap: React.FC<GPS51LiveMapProps> = ({
  className,
  autoStart = true,
  refreshInterval = 30000
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showOnlyMoving, setShowOnlyMoving] = useState(false);

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
    parkedVehicles,
    offlineVehicles
  } = useGPS51LiveTracking({
    autoStart,
    baseInterval: refreshInterval,
    adaptiveRefresh: true
  });

  // Filter vehicles based on user preference
  const displayVehicles = showOnlyMoving ? movingVehicles : vehicles;

  // Handle vehicle selection
  const handleVehicleSelect = (vehicle: LiveVehicleData) => {
    setSelectedVehicleId(
      selectedVehicleId === vehicle.device.deviceid ? null : vehicle.device.deviceid
    );
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Get status color for vehicle markers
  const getStatusColor = (status: LiveVehicleData['status']) => {
    switch (status) {
      case 'moving': return 'bg-green-500 animate-pulse';
      case 'parked': return 'bg-blue-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  // Get status text
  const getStatusText = (status: LiveVehicleData['status']) => {
    switch (status) {
      case 'moving': return 'Moving';
      case 'parked': return 'Parked';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  // Format speed
  const formatSpeed = (speed: number) => {
    return `${Math.round(speed)} km/h`;
  };

  // Format last update time
  const formatLastUpdate = (timestamp: number) => {
    if (!timestamp) return 'No data';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Map className="w-5 h-5" />
              <span>Live Fleet Tracking</span>
              {isTracking && (
                <Badge variant="default" className="ml-2 animate-pulse">
                  <Activity className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="flex items-center space-x-4 mt-1">
              <span>{vehicles.length} vehicles total</span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{movingVehicleCount} moving</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>{parkedVehicleCount} parked</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span>{offlineVehicleCount} offline</span>
              </span>
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Show only moving toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                checked={showOnlyMoving}
                onCheckedChange={setShowOnlyMoving}
                id="show-moving"
              />
              <label htmlFor="show-moving" className="text-sm">
                Moving only
              </label>
            </div>

            {/* Tracking controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={isTracking ? stopTracking : startTracking}
              disabled={isLoading}
            >
              {isTracking ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshNow}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="relative h-full min-h-[500px] bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
          {/* Map Container */}
          <div className="absolute inset-0 w-full h-full">
            {/* Placeholder Map Implementation */}
            <div className="w-full h-full flex flex-col items-center justify-start bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-6">
              <div className="text-center space-y-4 mb-6">
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-muted-foreground">Live Fleet Map</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time vehicle tracking with {refreshInterval / 1000}s updates
                  </p>
                </div>
              </div>
              
              {/* Vehicle Grid Display */}
              {error ? (
                <div className="text-center space-y-2">
                  <div className="text-red-500 text-sm">{error}</div>
                  <Button onClick={refreshNow} size="sm">
                    Retry
                  </Button>
                </div>
              ) : displayVehicles.length === 0 ? (
                <div className="text-center space-y-2">
                  <Car className="w-8 h-8 text-muted-foreground mx-auto" />
                  <div className="text-sm text-muted-foreground">
                    {showOnlyMoving ? 'No vehicles currently moving' : 'No vehicles found'}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto w-full max-w-4xl">
                  {displayVehicles.slice(0, 12).map(vehicle => (
                    <div 
                      key={vehicle.device.deviceid}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedVehicleId === vehicle.device.deviceid
                          ? 'border-primary bg-primary/10 shadow-md scale-105'
                          : 'border-border hover:border-primary/50 bg-background hover:shadow-sm'
                      }`}
                      onClick={() => handleVehicleSelect(vehicle)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(vehicle.status)}`} />
                          <span className="font-medium text-sm truncate">
                            {vehicle.device.devicename || vehicle.device.deviceid}
                          </span>
                        </div>
                        
                        <Badge variant="outline" className="text-xs">
                          {getStatusText(vehicle.status)}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {vehicle.position ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center space-x-1">
                                <Navigation className="w-3 h-3" />
                                <span>{formatSpeed(vehicle.speed)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{formatLastUpdate(vehicle.lastUpdate)}</span>
                              </span>
                            </div>
                            
                            {selectedVehicleId === vehicle.device.deviceid && (
                              <div className="mt-2 pt-2 border-t border-border space-y-1">
                                <div className="font-mono text-xs">
                                  {vehicle.position.callat.toFixed(6)}, {vehicle.position.callon.toFixed(6)}
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Course: {vehicle.position.course || 0}°</span>
                                  <span>Status: {vehicle.position.strstatus}</span>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-2">
                            No position data
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {displayVehicles.length > 12 && (
                    <div className="col-span-full text-center text-sm text-muted-foreground py-4">
                      +{displayVehicles.length - 12} more vehicles
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Status Overlay */}
          <div className="absolute top-4 left-4 space-y-2">
            {/* Live status indicator */}
            {isTracking && (
              <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">Live Tracking</span>
                  {lastUpdate && (
                    <span className="text-xs text-muted-foreground">
                      Updated {formatLastUpdate(lastUpdate.getTime())}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Update counter */}
            {totalUpdates > 0 && (
              <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2">
                <div className="text-xs font-medium">
                  {totalUpdates} updates • {displayVehicles.length} shown
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3">
            <div className="text-xs font-medium mb-2">Fleet Status</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <Zap className="w-3 h-3 text-green-500" />
                <span>{movingVehicleCount} active</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-3 h-3 text-blue-500" />
                <span>{parkedVehicleCount} parked</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};