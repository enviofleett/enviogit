import { useEffect, useRef, useState } from 'react';
import { Map as MapTilerMap, Marker, NavigationControl, GeolocateControl } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Satellite, RotateCcw, AlertTriangle } from 'lucide-react';
import type { GPS51Device } from '@/services/gps51/direct';
import { maptilerService } from '@/services/maptiler/MaptilerService';

interface MapContainerProps {
  vehicles: GPS51Device[];
  selectedVehicle: GPS51Device | null;
  onVehicleSelect: (vehicle: GPS51Device) => void;
}

export const MapContainer = ({ vehicles, selectedVehicle, onVehicleSelect }: MapContainerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapTilerMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    if (!mapContainer.current || map.current) return;

    try {
      // Get style URL with API key
      const styleUrl = await maptilerService.getStyleUrl(mapStyle);
      
      if (!styleUrl) {
        setMapError('Maptiler API key not configured. Please configure it in Settings → Maps.');
        setIsLoading(false);
        setHasApiKey(false);
        return;
      }

      setHasApiKey(true);
      setMapError(null);

      // Initialize map
      map.current = new MapTilerMap({
        container: mapContainer.current,
        style: styleUrl,
        center: [0, 0], // Will be updated based on vehicles
        zoom: 10,
      });

      // Add controls
      map.current.addControl(new NavigationControl(), 'top-right');
      map.current.addControl(new GeolocateControl({}), 'top-right');

      map.current.on('load', () => {
        setIsLoading(false);
        fitMapToVehicles();
        // Log usage for monitoring
        maptilerService.logUsage('map_initialization');
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Failed to load map. Please check your Maptiler configuration.');
        setIsLoading(false);
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('Failed to initialize map. Please check your internet connection.');
      setIsLoading(false);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  };

  // Update map style
  useEffect(() => {
    updateMapStyle();
  }, [mapStyle]);

  const updateMapStyle = async () => {
    if (!map.current || !hasApiKey) return;

    try {
      const styleUrl = await maptilerService.getStyleUrl(mapStyle);
      if (styleUrl) {
        map.current.setStyle(styleUrl);
        maptilerService.logUsage('style_change');
      }
    } catch (error) {
      console.error('Failed to update map style:', error);
    }
  };

  // Update vehicle markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Add markers for vehicles with valid coordinates
    vehicles.forEach(vehicle => {
      const lat = Number(vehicle.callat);
      const lng = Number(vehicle.callon);

      // Skip vehicles without valid coordinates
      if (!lat || !lng || lat === 0 || lng === 0) return;

      const isSelected = selectedVehicle?.deviceid === vehicle.deviceid;
      const status = getVehicleStatus(vehicle);
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = `cursor-pointer transition-all duration-200 ${isSelected ? 'scale-125' : 'hover:scale-110'}`;
      el.innerHTML = createMarkerIcon(vehicle, status, isSelected);

      // Create marker
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map.current!);

      // Add click handler
      el.addEventListener('click', () => {
        onVehicleSelect(vehicle);
      });

      // Add popup
      const popup = document.createElement('div');
      popup.className = 'p-2 bg-background border border-border rounded-md shadow-lg min-w-48';
      popup.innerHTML = `
        <div class="font-semibold text-sm">${vehicle.devicename}</div>
        <div class="text-xs text-muted-foreground">${vehicle.deviceid}</div>
        <div class="text-xs mt-1 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full ${getStatusColor(status)}"></span>
          ${status.charAt(0).toUpperCase() + status.slice(1)}
          ${vehicle.speed ? ` • ${Math.round(vehicle.speed)} mph` : ''}
        </div>
        <div class="text-xs text-muted-foreground mt-1">
          ${vehicle.lastactivetime ? new Date(vehicle.lastactivetime).toLocaleString() : 'No recent data'}
        </div>
      `;

      // Add hover popup (simplified for demo)
      el.addEventListener('mouseenter', () => {
        // TODO: Add proper popup implementation
      });

      markersRef.current.set(vehicle.deviceid, marker);
    });

    // Fit map to show all vehicles if none selected
    if (!selectedVehicle && vehicles.length > 0) {
      fitMapToVehicles();
    }
  }, [vehicles, selectedVehicle]);

  // Focus on selected vehicle
  useEffect(() => {
    if (selectedVehicle && map.current) {
      const lat = Number(selectedVehicle.callat);
      const lng = Number(selectedVehicle.callon);
      
      if (lat && lng && lat !== 0 && lng !== 0) {
        map.current.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1000
        });
      }
    }
  }, [selectedVehicle]);

  const getVehicleStatus = (vehicle: GPS51Device): 'online' | 'idle' | 'offline' => {
    const now = Date.now();
    const lastActiveTime = vehicle.lastactivetime || 0;
    const minutesSinceUpdate = (now - lastActiveTime) / (1000 * 60);
    
    if (minutesSinceUpdate > 240) return 'offline'; // 4 hours
    if ((vehicle.speed || 0) > 5) return 'online';
    return 'idle';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const createMarkerIcon = (vehicle: GPS51Device, status: string, isSelected: boolean): string => {
    const statusColor = status === 'online' ? '#10b981' : status === 'idle' ? '#f59e0b' : '#ef4444';
    const size = isSelected ? 32 : 24;
    
    return `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${statusColor};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ${isSelected ? 'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);' : ''}
      ">
        <svg width="${size - 8}" height="${size - 8}" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;
  };

  const fitMapToVehicles = () => {
    if (!map.current || vehicles.length === 0) return;

    const validVehicles = vehicles.filter(v => {
      const lat = Number(v.callat);
      const lng = Number(v.callon);
      return lat && lng && lat !== 0 && lng !== 0;
    });

    if (validVehicles.length === 0) return;

    if (validVehicles.length === 1) {
      const vehicle = validVehicles[0];
      map.current.setCenter([Number(vehicle.callon), Number(vehicle.callat)]);
      map.current.setZoom(15);
      return;
    }

    // Calculate bounds
    const lngs = validVehicles.map(v => Number(v.callon));
    const lats = validVehicles.map(v => Number(v.callat));
    
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    map.current.fitBounds([
      [minLng, minLat],
      [maxLng, maxLat]
    ], {
      padding: 50,
      duration: 1000
    });
  };

  const handleStyleChange = () => {
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets');
  };

  const handleResetView = () => {
    fitMapToVehicles();
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-center">
              {mapError}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleStyleChange}
          className="flex items-center gap-2"
        >
          <Satellite className="h-4 w-4" />
          {mapStyle === 'streets' ? 'Satellite' : 'Streets'}
        </Button>
        
        <Button
          size="sm"
          variant="secondary"
          onClick={handleResetView}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset View
        </Button>
      </div>

      {/* Vehicle Count Badge */}
      <Card className="absolute bottom-4 left-4 p-2">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          <span>{vehicles.filter(v => v.callat && v.callon).length} vehicles on map</span>
        </div>
      </Card>
    </div>
  );
};