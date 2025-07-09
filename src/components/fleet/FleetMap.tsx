/**
 * Fleet Map Component
 * Interactive map showing real-time vehicle positions
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Locate, AlertCircle } from 'lucide-react';
import { GPS51Vehicle, GPS51Position } from '@/services/gps51/GPS51ProductionService';
import { MapTilerService } from '@/services/maps/MapTilerService';
import { useMapSettings } from '@/hooks/useMapSettings';

interface FleetMapProps {
  vehicles: GPS51Vehicle[];
  positions: GPS51Position[];
  selectedVehicle?: string | null;
  onVehicleSelect?: (vehicleId: string) => void;
  mapStyle?: 'street' | 'satellite';
}

const FleetMap: React.FC<FleetMapProps> = ({
  vehicles,
  positions,
  selectedVehicle,
  onVehicleSelect,
  mapStyle = 'street'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapService, setMapService] = useState<MapTilerService | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, isLoading: settingsLoading } = useMapSettings();

  // Initialize map with MapTiler
  useEffect(() => {
    const initializeMap = async () => {
      if (!mapRef.current || settingsLoading || !settings.apiKey) return;
      
      try {
        setError(null);
        
        const mapTilerConfig = {
          apiKey: settings.apiKey,
          style: mapStyle === 'satellite' ? 'satellite' : 'streets' as 'streets' | 'satellite' | 'terrain' | 'hybrid',
          center: [settings.centerLng, settings.centerLat] as [number, number],
          zoom: settings.zoomLevel
        };

        const service = new MapTilerService(mapTilerConfig);
        const initialized = await service.initialize(mapRef.current);
        
        if (initialized) {
          setMapService(service);
          setMapLoaded(true);
          console.log('MapTiler initialized successfully');
        } else {
          setError('Failed to initialize map service');
        }
      } catch (error) {
        console.error('Map initialization error:', error);
        setError('Map initialization failed. Please check your API key in Settings > Maps.');
      }
    };

    // Cleanup existing map
    if (mapService) {
      mapService.destroy();
      setMapService(null);
      setMapLoaded(false);
    }

    initializeMap();

    return () => {
      if (mapService) {
        mapService.destroy();
      }
    };
  }, [settings, mapStyle, settingsLoading]);

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapService || !mapLoaded) return;

    // Clear existing markers
    mapService.clearMarkers();

    // Add markers for vehicles with positions
    vehicles.forEach(vehicle => {
      if (!vehicle.position) return;

      const { callat: lat, callon: lng } = vehicle.position;
      
      mapService.addMarker({
        id: vehicle.deviceid,
        position: [lng, lat],
        title: vehicle.devicename,
        status: vehicle.isMoving ? 'moving' : vehicle.position ? 'stationary' : 'offline',
        speed: vehicle.speed,
        lastUpdate: vehicle.lastUpdate
      });

      // Handle vehicle selection
      if (selectedVehicle === vehicle.deviceid) {
        // You could add visual selection feedback here
      }
    });

    // Fit map to show all vehicles
    if (vehicles.length > 0) {
      const coordinates = vehicles
        .filter(v => v.position)
        .map(v => [v.position!.callon, v.position!.callat] as [number, number]);
      
      if (coordinates.length > 0) {
        mapService.fitBounds(coordinates, 50);
      }
    }
  }, [mapService, mapLoaded, vehicles, selectedVehicle]);

  // Add custom styles for markers
  useEffect(() => {
    if (!document.getElementById('fleet-map-styles')) {
      const style = document.createElement('style');
      style.id = 'fleet-map-styles';
      style.textContent = `
        .vehicle-marker {
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        
        .vehicle-marker:hover {
          transform: scale(1.1);
        }
        
        .vehicle-marker.selected {
          transform: scale(1.2);
        }
        
        .vehicle-marker.moving .marker-icon {
          color: #10b981;
          animation: pulse 2s infinite;
        }
        
        .vehicle-marker.stationary .marker-icon {
          color: #6b7280;
        }
        
        .marker-content {
          display: flex;
          align-items: center;
          background: white;
          border-radius: 8px;
          padding: 4px 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          border: 2px solid #e5e7eb;
        }
        
        .vehicle-marker.selected .marker-content {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }
        
        .marker-icon {
          margin-right: 6px;
          display: flex;
          align-items: center;
        }
        
        .marker-info {
          font-size: 11px;
          line-height: 1.2;
        }
        
        .vehicle-name {
          font-weight: 600;
          color: #374151;
        }
        
        .vehicle-speed {
          color: #6b7280;
        }
        
        .vehicle-popup {
          font-size: 14px;
        }
        
        .vehicle-popup h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .vehicle-popup p {
          margin: 4px 0;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (settingsLoading || !mapLoaded) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            {settingsLoading ? (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-muted-foreground">Loading map settings...</p>
              </>
            ) : error ? (
              <>
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                <div>
                  <p className="text-destructive font-medium">Map Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.location.href = '/settings?tab=maps'}
                  >
                    Configure Maps
                  </Button>
                </div>
              </>
            ) : !settings.apiKey ? (
              <>
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium">Map Service Not Configured</p>
                  <p className="text-sm text-muted-foreground">Please configure your map API key</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.location.href = '/settings?tab=maps'}
                  >
                    Configure Maps
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-muted-foreground">Initializing map...</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative h-full">
      <div ref={mapRef} className="h-full w-full rounded-lg" />
      
      {/* Map overlay with vehicle count */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">
            {vehicles.filter(v => v.position).length} vehicles tracked
          </span>
        </div>
        
        <div className="flex items-center space-x-4 mt-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>{vehicles.filter(v => v.isMoving).length} moving</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>{vehicles.filter(v => !v.isMoving && v.position).length} parked</span>
          </div>
        </div>
      </div>

      {/* Center on fleet button */}
      {vehicles.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm"
          onClick={() => {
            if (mapService && vehicles.length > 0) {
              const coordinates = vehicles
                .filter(v => v.position)
                .map(v => [v.position!.callon, v.position!.callat] as [number, number]);
              
              if (coordinates.length > 0) {
                mapService.fitBounds(coordinates, 50);
              }
            }
          }}
        >
          <Locate className="w-4 h-4 mr-2" />
          Center Fleet
        </Button>
      )}
    </div>
  );
};

export default FleetMap;