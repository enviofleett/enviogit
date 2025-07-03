import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Maximize2, Minimize2, RefreshCw, Map } from 'lucide-react';
import type { GPS51Device, GPS51Position } from '@/services/gps51/direct';

interface GPS51DirectMapViewProps {
  vehicles: GPS51Device[];
  positions: GPS51Position[];
  isLiveTracking?: boolean;
  selectedVehicleId?: string;
  onVehicleSelect?: (vehicleId: string) => void;
  className?: string;
}

interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isMoving: boolean;
  speed: number;
  lastUpdate: number;
  status: 'online' | 'offline' | 'moving';
}

export const GPS51DirectMapView: React.FC<GPS51DirectMapViewProps> = ({
  vehicles,
  positions,
  isLiveTracking = false,
  selectedVehicleId,
  onVehicleSelect,
  className
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [markers, setMarkers] = useState<MapMarker[]>([]);

  // Calculate map markers from vehicles and positions
  useEffect(() => {
    const positionMap: Record<string, GPS51Position> = {};
    positions.forEach(position => {
      const existing = positionMap[position.deviceid];
      if (!existing || position.updatetime > existing.updatetime) {
        positionMap[position.deviceid] = position;
      }
    });

    const newMarkers: MapMarker[] = [];
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);

    vehicles.forEach(vehicle => {
      const position = positionMap[vehicle.deviceid];
      
      // Use position coordinates if available, otherwise use vehicle coordinates
      const lat = position?.callat || vehicle.callat;
      const lon = position?.callon || vehicle.callon;
      
      if (lat && lon && lat !== 0 && lon !== 0) {
        const isRecent = vehicle.lastactivetime > thirtyMinutesAgo;
        const isMoving = position?.moving === 1 && (position?.speed || 0) > 5;
        
        newMarkers.push({
          id: vehicle.deviceid,
          name: vehicle.devicename,
          lat,
          lng: lon,
          isMoving,
          speed: position?.speed || 0,
          lastUpdate: position?.updatetime || vehicle.lastactivetime,
          status: isMoving ? 'moving' : isRecent ? 'online' : 'offline'
        });
      }
    });

    setMarkers(newMarkers);
  }, [vehicles, positions]);

  // Initialize simple map (placeholder implementation)
  useEffect(() => {
    if (!mapContainerRef.current || mapInitialized) return;

    // This is a placeholder for map initialization
    // In a real implementation, you would initialize your preferred map library here
    // (Google Maps, Mapbox, OpenStreetMap, etc.)
    
    setMapInitialized(true);
  }, [mapInitialized]);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle refresh
  const handleRefresh = () => {
    // Trigger map refresh logic
    console.log('Refreshing map view...');
  };

  // Get status color for markers
  const getStatusColor = (status: MapMarker['status']) => {
    switch (status) {
      case 'moving': return 'bg-green-500';
      case 'online': return 'bg-blue-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  // Format speed display
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
              <span>Live Map</span>
              {isLiveTracking && (
                <Badge variant="default" className="ml-2 animate-pulse">
                  Live
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {markers.length} vehicles with location data
              {selectedVehicleId && ` • Focused on ${vehicles.find(v => v.deviceid === selectedVehicleId)?.devicename}`}
            </CardDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4" />
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
        <div className="relative h-full min-h-[400px] bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
          {/* Map Container */}
          <div 
            ref={mapContainerRef}
            className="absolute inset-0 w-full h-full"
          >
            {/* Placeholder Map Implementation */}
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <div className="text-center space-y-4">
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-muted-foreground">Interactive Map</h3>
                  <p className="text-sm text-muted-foreground">
                    Map integration placeholder - Ready for your preferred mapping library
                  </p>
                </div>
                
                {/* Mock map data visualization */}
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto">
                  <div className="text-xs text-muted-foreground text-left">
                    Map would show {markers.length} vehicle markers:
                  </div>
                  
                  {markers.slice(0, 5).map(marker => (
                    <div 
                      key={marker.id}
                      className={`flex items-center justify-between p-2 rounded border ${
                        selectedVehicleId === marker.id ? 'bg-primary/10 border-primary' : 'bg-background'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(marker.status)}`} />
                        <span className="text-xs font-medium">{marker.name}</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {marker.isMoving ? formatSpeed(marker.speed) : formatLastUpdate(marker.lastUpdate)}
                      </div>
                    </div>
                  ))}
                  
                  {markers.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{markers.length - 5} more vehicles
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Map Controls Overlay */}
          <div className="absolute top-4 left-4 space-y-2">
            {/* Live tracking indicator */}
            {isLiveTracking && (
              <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-medium">Live Tracking</span>
                </div>
              </div>
            )}
            
            {/* Vehicle count */}
            <div className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2">
              <div className="text-xs font-medium">
                {markers.length} / {vehicles.length} vehicles visible
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border rounded-lg p-3">
            <div className="text-xs font-medium mb-2">Status</div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-xs">Moving</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-xs">Online</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full" />
                <span className="text-xs">Offline</span>
              </div>
            </div>
          </div>

          {/* No vehicles message */}
          {markers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Navigation className="w-8 h-8 text-muted-foreground mx-auto" />
                <div className="text-sm text-muted-foreground">
                  No vehicles with location data
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};