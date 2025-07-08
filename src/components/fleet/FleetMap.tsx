/**
 * Fleet Map Component
 * Interactive map showing real-time vehicle positions
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Locate, ZoomIn, ZoomOut } from 'lucide-react';
import { GPS51Vehicle, GPS51Position } from '@/services/gps51/GPS51UnifiedLiveDataService';

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
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<Map<string, any>>(new Map());
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  // Load Mapbox with proper error handling
  useEffect(() => {
    const loadMapbox = async () => {
      try {
        // Check if mapbox-gl is available
        if (typeof window !== 'undefined' && (window as any).mapboxgl) {
          const mapboxgl = (window as any).mapboxgl;
          setMapboxLoaded(true);
          
          // Set demo token for development
          mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';
          
          if (mapRef.current) {
            const mapInstance = new mapboxgl.Map({
            container: mapRef.current,
            style: mapStyle === 'satellite' 
              ? 'mapbox://styles/mapbox/satellite-v9'
              : 'mapbox://styles/mapbox/streets-v11',
            center: [3.3792, 6.5244], // Default to Lagos, Nigeria
            zoom: 10,
            pitch: 0,
            bearing: 0
          });

            // Add navigation controls
            mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
            
            // Add geolocate control
            mapInstance.addControl(
              new mapboxgl.GeolocateControl({
              positionOptions: {
                enableHighAccuracy: true
              },
              trackUserLocation: true,
              showUserHeading: true
            }),
            'top-right'
          );

          setMap(mapInstance);

          return () => {
            mapInstance.remove();
          };
        }
        } else {
          // Fallback: Show message that map requires Mapbox
          console.warn('Mapbox GL JS not available. Please include Mapbox script.');
        }
      } catch (error) {
        console.error('Failed to load Mapbox:', error);
      }
    };

    loadMapbox();
  }, [mapStyle]);

  // Update markers when vehicles change
  useEffect(() => {
    if (!map || !mapboxLoaded) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    const newMarkers = new Map();

    // Add markers for vehicles with positions
    vehicles.forEach(vehicle => {
      if (!vehicle.position) return;

      const { callat: lat, callon: lng } = vehicle.position;
      
      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = `vehicle-marker ${vehicle.isMoving ? 'moving' : 'stationary'} ${
        selectedVehicle === vehicle.deviceid ? 'selected' : ''
      }`;
      markerElement.innerHTML = `
        <div class="marker-content">
          <div class="marker-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.2 8.6L20 7.4L12 15L10.8 8.4L4 9.6L12 2Z" fill="currentColor"/>
            </svg>
          </div>
          <div class="marker-info">
            <div class="vehicle-name">${vehicle.devicename}</div>
            <div class="vehicle-speed">${vehicle.speed} km/h</div>
          </div>
        </div>
      `;

      // Create popup
      const popup = new (window as any).mapboxgl.Popup({
        offset: 25,
        closeButton: false
      }).setHTML(`
        <div class="vehicle-popup">
          <h3>${vehicle.devicename}</h3>
          <p><strong>Speed:</strong> ${vehicle.speed} km/h</p>
          <p><strong>Status:</strong> ${vehicle.isMoving ? 'Moving' : 'Parked'}</p>
          <p><strong>Last Update:</strong> ${vehicle.lastUpdate.toLocaleTimeString()}</p>
          ${vehicle.position?.strstatusen ? `<p><strong>Device Status:</strong> ${vehicle.position.strstatusen}</p>` : ''}
        </div>
      `);

      // Create marker
      const marker = new (window as any).mapboxgl.Marker(markerElement)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      // Add click handler
      markerElement.addEventListener('click', () => {
        onVehicleSelect?.(vehicle.deviceid);
      });

      newMarkers.set(vehicle.deviceid, marker);
    });

    setMarkers(newMarkers);

    // Fit map to show all vehicles
    if (vehicles.length > 0) {
      const coordinates = vehicles
        .filter(v => v.position)
        .map(v => [v.position!.callon, v.position!.callat]);
      
      if (coordinates.length > 0) {
        const bounds = new (window as any).mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        
        map.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
      }
    }
  }, [map, vehicles, selectedVehicle, mapboxLoaded]);

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

  if (!mapboxLoaded) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading map...</p>
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
            if (map && vehicles.length > 0) {
              const coordinates = vehicles
                .filter(v => v.position)
                .map(v => [v.position!.callon, v.position!.callat]);
              
              if (coordinates.length > 0) {
                const bounds = new (window as any).mapboxgl.LngLatBounds();
                coordinates.forEach(coord => bounds.extend(coord));
                
                map.fitBounds(bounds, {
                  padding: 50,
                  maxZoom: 15
                });
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