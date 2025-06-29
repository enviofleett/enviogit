
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GeofenceZone {
  id: string;
  name: string;
  coordinates: [number, number][];
  updateFrequency: number; // seconds
}

interface VehicleUpdateStrategy {
  vehicleId: string;
  currentFrequency: number;
  lastKnownSpeed: number;
  isInGeofence: boolean;
  geofenceId?: string;
  lastPositionUpdate: Date;
  consecutiveStops: number;
}

export const useIntelligentFiltering = () => {
  const [geofences, setGeofences] = useState<GeofenceZone[]>([]);
  const [updateStrategies, setUpdateStrategies] = useState<Map<string, VehicleUpdateStrategy>>(new Map());
  const [lastSyncData, setLastSyncData] = useState<Map<string, any>>(new Map());

  // Load geofences from database or configuration
  useEffect(() => {
    const loadGeofences = async () => {
      // Default geofences for high-activity areas
      const defaultGeofences: GeofenceZone[] = [
        {
          id: 'city-center',
          name: 'City Center',
          coordinates: [
            [6.4474, 3.3903], // Lagos coordinates as example
            [6.4574, 3.3903],
            [6.4574, 3.4003],
            [6.4474, 3.4003],
            [6.4474, 3.3903]
          ],
          updateFrequency: 30 // 30 seconds for high-activity areas
        },
        {
          id: 'airport-zone',
          name: 'Airport Zone',
          coordinates: [
            [6.5774, 3.3211],
            [6.5874, 3.3211],
            [6.5874, 3.3311],
            [6.5774, 3.3311],
            [6.5774, 3.3211]
          ],
          updateFrequency: 45 // 45 seconds for airport area
        }
      ];

      setGeofences(defaultGeofences);
    };

    loadGeofences();
  }, []);

  const isPointInPolygon = useCallback((point: [number, number], polygon: [number, number][]): boolean => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }, []);

  const determineUpdateFrequency = useCallback((
    vehicleId: string,
    latitude: number,
    longitude: number,
    speed: number,
    ignitionStatus: boolean
  ): number => {
    const point: [number, number] = [latitude, longitude];
    
    // Check if vehicle is in any geofence
    const geofence = geofences.find(zone => 
      isPointInPolygon(point, zone.coordinates)
    );

    // Base frequency logic
    let frequency = 300; // 5 minutes default

    if (geofence) {
      frequency = geofence.updateFrequency;
    } else if (ignitionStatus && speed > 5) {
      // Moving vehicle - more frequent updates
      if (speed > 50) {
        frequency = 30; // Every 30 seconds for fast-moving vehicles
      } else if (speed > 20) {
        frequency = 60; // Every minute for moderate speed
      } else {
        frequency = 120; // Every 2 minutes for slow moving
      }
    } else if (ignitionStatus && speed <= 5) {
      // Idling vehicle
      frequency = 180; // Every 3 minutes
    } else {
      // Parked/off vehicle
      frequency = 900; // Every 15 minutes
    }

    // Update strategy for this vehicle
    setUpdateStrategies(prev => {
      const newStrategies = new Map(prev);
      const current = newStrategies.get(vehicleId);
      
      newStrategies.set(vehicleId, {
        vehicleId,
        currentFrequency: frequency,
        lastKnownSpeed: speed,
        isInGeofence: !!geofence,
        geofenceId: geofence?.id,
        lastPositionUpdate: new Date(),
        consecutiveStops: ignitionStatus && speed <= 5 ? (current?.consecutiveStops || 0) + 1 : 0
      });

      return newStrategies;
    });

    return frequency;
  }, [geofences, isPointInPolygon]);

  const shouldSyncPosition = useCallback((
    vehicleId: string,
    newPosition: any,
    lastPosition?: any
  ): boolean => {
    if (!lastPosition) return true;

    const lastSyncPos = lastSyncData.get(vehicleId);
    if (!lastSyncPos) {
      setLastSyncData(prev => new Map(prev.set(vehicleId, newPosition)));
      return true;
    }

    // Check if position has meaningfully changed
    const latDiff = Math.abs(newPosition.latitude - lastSyncPos.latitude);
    const lonDiff = Math.abs(newPosition.longitude - lastSyncPos.longitude);
    const speedDiff = Math.abs(newPosition.speed - lastSyncPos.speed);
    const ignitionChanged = newPosition.ignition_status !== lastSyncPos.ignition_status;

    // Sync if:
    // 1. Position changed by more than ~10 meters (roughly 0.0001 degrees)
    // 2. Speed changed by more than 5 km/h
    // 3. Ignition status changed
    // 4. More than the determined frequency has passed
    const strategy = updateStrategies.get(vehicleId);
    const timeSinceLastSync = strategy ? 
      (Date.now() - strategy.lastPositionUpdate.getTime()) / 1000 : 
      999999;

    const shouldSync = 
      latDiff > 0.0001 ||
      lonDiff > 0.0001 ||
      speedDiff > 5 ||
      ignitionChanged ||
      (strategy && timeSinceLastSync > strategy.currentFrequency);

    if (shouldSync) {
      setLastSyncData(prev => new Map(prev.set(vehicleId, newPosition)));
    }

    return shouldSync;
  }, [lastSyncData, updateStrategies]);

  const getVehiclesByPriority = useCallback(() => {
    const strategies = Array.from(updateStrategies.values());
    
    // Priority 1: Moving vehicles in geofences
    const priority1 = strategies.filter(s => s.isInGeofence && s.lastKnownSpeed > 5);
    
    // Priority 2: Moving vehicles outside geofences
    const priority2 = strategies.filter(s => !s.isInGeofence && s.lastKnownSpeed > 5);
    
    // Priority 3: Idling vehicles (ignition on, speed low)
    const priority3 = strategies.filter(s => s.lastKnownSpeed <= 5 && s.consecutiveStops < 3);
    
    // Priority 4: Parked vehicles
    const priority4 = strategies.filter(s => s.consecutiveStops >= 3);

    return { priority1, priority2, priority3, priority4 };
  }, [updateStrategies]);

  return {
    determineUpdateFrequency,
    shouldSyncPosition,
    getVehiclesByPriority,
    geofences,
    updateStrategies: Array.from(updateStrategies.values())
  };
};
