import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface LiveTrackingOptions {
  autoStart?: boolean;
  baseInterval?: number; // milliseconds, default 30000 (30s)
  adaptiveRefresh?: boolean;
  maxInterval?: number; // max interval for inactive vehicles
  minInterval?: number; // min interval for active vehicles
}

export interface LiveVehicleData {
  device: GPS51Device;
  position: GPS51Position | null;
  isMoving: boolean;
  speed: number;
  lastUpdate: number;
  status: 'online' | 'offline' | 'moving' | 'parked';
  refreshInterval: number;
}

export interface LiveTrackingState {
  vehicles: LiveVehicleData[];
  isTracking: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  activeVehicleCount: number;
  movingVehicleCount: number;
  totalUpdates: number;
}

export const useGPS51LiveTracking = (options: LiveTrackingOptions = {}) => {
  const {
    autoStart = false,
    baseInterval = 30000,
    adaptiveRefresh = true,
    maxInterval = 120000, // 2 minutes for inactive
    minInterval = 15000   // 15 seconds for active
  } = options;

  const [state, setState] = useState<LiveTrackingState>({
    vehicles: [],
    isTracking: false,
    isLoading: false,
    error: null,
    lastUpdate: null,
    activeVehicleCount: 0,
    movingVehicleCount: 0,
    totalUpdates: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryTimeRef = useRef<number>(0);
  const vehicleActivityRef = useRef<Map<string, { lastMovementTime: number; consecutiveStationary: number }>>(new Map());

  // Calculate adaptive refresh interval for each vehicle
  const calculateRefreshInterval = useCallback((vehicle: LiveVehicleData): number => {
    if (!adaptiveRefresh) return baseInterval;

    const activity = vehicleActivityRef.current.get(vehicle.device.deviceid);
    const now = Date.now();
    
    if (vehicle.isMoving || vehicle.speed > 5) {
      // Moving vehicles get faster updates
      return minInterval;
    }
    
    if (activity) {
      const timeSinceMovement = now - activity.lastMovementTime;
      const stationaryCount = activity.consecutiveStationary;
      
      // Gradually increase interval for stationary vehicles
      if (timeSinceMovement > 600000) { // 10 minutes stationary
        return Math.min(maxInterval, baseInterval * (1 + stationaryCount * 0.5));
      }
    }
    
    return baseInterval;
  }, [adaptiveRefresh, baseInterval, minInterval, maxInterval]);

  // Update vehicle activity tracking
  const updateVehicleActivity = useCallback((vehicles: LiveVehicleData[]) => {
    const now = Date.now();
    
    vehicles.forEach(vehicle => {
      const deviceId = vehicle.device.deviceid;
      const activity = vehicleActivityRef.current.get(deviceId) || { 
        lastMovementTime: now, 
        consecutiveStationary: 0 
      };
      
      if (vehicle.isMoving || vehicle.speed > 5) {
        // Vehicle is moving
        activity.lastMovementTime = now;
        activity.consecutiveStationary = 0;
      } else {
        // Vehicle is stationary
        activity.consecutiveStationary += 1;
      }
      
      vehicleActivityRef.current.set(deviceId, activity);
    });
  }, []);

  // Convert GPS51 data to live tracking format
  const convertToLiveData = useCallback((devices: GPS51Device[], positions: GPS51Position[]): LiveVehicleData[] => {
    const positionMap = new Map<string, GPS51Position>();
    positions.forEach(pos => {
      const existing = positionMap.get(pos.deviceid);
      if (!existing || pos.updatetime > existing.updatetime) {
        positionMap.set(pos.deviceid, pos);
      }
    });

    return devices.map(device => {
      const position = positionMap.get(device.deviceid) || null;
      const speed = position?.speed || 0;
      const isMoving = speed > 1 && position?.moving === 1;
      const lastUpdate = position?.updatetime ? position.updatetime * 1000 : 0;
      const now = Date.now();
      const isRecent = lastUpdate > now - 300000; // 5 minutes
      
      let status: LiveVehicleData['status'] = 'offline';
      if (isRecent) {
        status = isMoving ? 'moving' : 'parked';
      } else if (position) {
        status = 'offline';
      }

      const vehicleData: LiveVehicleData = {
        device,
        position,
        isMoving,
        speed,
        lastUpdate,
        status,
        refreshInterval: baseInterval
      };

      // Calculate adaptive refresh interval
      vehicleData.refreshInterval = calculateRefreshInterval(vehicleData);

      return vehicleData;
    });
  }, [calculateRefreshInterval, baseInterval]);

  // Fetch live data
  const fetchLiveData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!gps51EmergencyManager.isAuthenticated()) {
        throw new Error('Not authenticated with GPS51');
      }

      if (gps51EmergencyManager.isEmergencyStopActive()) {
        throw new Error('GPS51 Emergency Stop is active');
      }

      // Get device list (cached for 10 minutes)
      const devices = await gps51EmergencyManager.getDeviceList(false);
      
      if (devices.length === 0) {
        setState(prev => ({
          ...prev,
          vehicles: [],
          isLoading: false,
          lastUpdate: new Date(),
          activeVehicleCount: 0,
          movingVehicleCount: 0
        }));
        return;
      }

      // Get positions for all devices
      const deviceIds = devices.map(d => d.deviceid);
      const result = await gps51EmergencyManager.getRealtimePositions(
        deviceIds, 
        lastQueryTimeRef.current, 
        false
      );

      // Convert to live tracking format
      const liveVehicles = convertToLiveData(devices, result.positions);
      
      // Update vehicle activity tracking
      updateVehicleActivity(liveVehicles);

      // Calculate statistics
      const activeCount = liveVehicles.filter(v => v.status !== 'offline').length;
      const movingCount = liveVehicles.filter(v => v.status === 'moving').length;

      setState(prev => ({
        ...prev,
        vehicles: liveVehicles,
        isLoading: false,
        lastUpdate: new Date(),
        activeVehicleCount: activeCount,
        movingVehicleCount: movingCount,
        totalUpdates: prev.totalUpdates + 1
      }));

      // Update last query time
      lastQueryTimeRef.current = result.lastQueryTime;

      console.log('GPS51LiveTracking: Updated', {
        vehicles: liveVehicles.length,
        active: activeCount,
        moving: movingCount,
        positions: result.positions.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch live data';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false
      }));
      console.error('GPS51LiveTracking: Fetch failed:', error);
    }
  }, [convertToLiveData, updateVehicleActivity]);

  // Start live tracking
  const startTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setState(prev => ({ ...prev, isTracking: true }));
    
    // Reset query time for fresh start
    lastQueryTimeRef.current = 0;
    
    // Initial fetch
    fetchLiveData();

    // Set up interval with the base interval
    // Individual vehicles will have their own adaptive intervals handled internally
    intervalRef.current = setInterval(fetchLiveData, baseInterval);
    
    console.log('GPS51LiveTracking: Started with base interval', baseInterval);
  }, [fetchLiveData, baseInterval]);

  // Stop live tracking
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setState(prev => ({ ...prev, isTracking: false }));
    console.log('GPS51LiveTracking: Stopped');
  }, []);

  // Refresh immediately
  const refreshNow = useCallback(() => {
    lastQueryTimeRef.current = 0; // Force full refresh
    return fetchLiveData();
  }, [fetchLiveData]);

  // Track specific vehicle more frequently
  const trackVehicle = useCallback((deviceId: string, highFrequency = true) => {
    const interval = highFrequency ? minInterval : baseInterval;
    console.log(`GPS51LiveTracking: Tracking vehicle ${deviceId} at ${interval}ms interval`);
    // This would implement per-vehicle tracking in a more advanced version
  }, [minInterval, baseInterval]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startTracking();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoStart, startTracking]);

  // Listen for authentication events
  useEffect(() => {
    const handleAuthSuccess = () => {
      if (state.isTracking) {
        refreshNow();
      }
    };

    window.addEventListener('gps51-emergency-auth-success', handleAuthSuccess);
    return () => window.removeEventListener('gps51-emergency-auth-success', handleAuthSuccess);
  }, [state.isTracking, refreshNow]);

  return {
    ...state,
    startTracking,
    stopTracking,
    refreshNow,
    trackVehicle,
    // Computed properties
    offlineVehicleCount: state.vehicles.length - state.activeVehicleCount,
    parkedVehicleCount: state.activeVehicleCount - state.movingVehicleCount,
    // Quick access to vehicles by status
    movingVehicles: state.vehicles.filter(v => v.status === 'moving'),
    parkedVehicles: state.vehicles.filter(v => v.status === 'parked'),
    offlineVehicles: state.vehicles.filter(v => v.status === 'offline')
  };
};