
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebSocketConnection } from './useWebSocketConnection';
import { useIntelligentFiltering } from './useIntelligentFiltering';
import { scalingService } from '@/services/scaling/ScalingService';
import { costOptimizationService } from '@/services/optimization/CostOptimizationService';
import { advancedAnalyticsService } from '@/services/analytics/AdvancedAnalyticsService';

export interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  moving: number;
  strstatus: string;
  totaldistance: number;
  course: number;
  altitude: number;
  radius: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
}

export interface LiveDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
  enableWebSocket?: boolean;
  enableIntelligentFiltering?: boolean;
}

export interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedDevices: number;
  offlineVehicles: number;
  totalDistance: number;
  averageSpeed: number;
  vehiclesWithGPS: number;
  vehiclesWithoutGPS: number;
  realTimeConnected: boolean;
  lastUpdateTime: Date | null;
}

export const useGPS51LiveData = (options: LiveDataOptions = {}) => {
  const { 
    enabled = true, 
    refreshInterval = 30000, 
    maxRetries = 3,
    enableWebSocket = true,
    enableIntelligentFiltering = true
  } = options;

  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [metrics, setMetrics] = useState<FleetMetrics>({
    totalDevices: 0,
    activeDevices: 0,
    movingVehicles: 0,
    parkedDevices: 0,
    offlineVehicles: 0,
    totalDistance: 0,
    averageSpeed: 0,
    vehiclesWithGPS: 0,
    vehiclesWithoutGPS: 0,
    realTimeConnected: false,
    lastUpdateTime: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Initialize intelligent filtering
  const {
    shouldSyncPosition,
    determineUpdateFrequency,
    getVehiclesByPriority
  } = useIntelligentFiltering();

  // Handle WebSocket position updates
  const handlePositionUpdate = useCallback((vehicleId: string, position: any) => {
    console.log('Real-time position update received:', vehicleId, position);
    
    setPositions(prev => {
      const existingIndex = prev.findIndex(p => p.deviceid === vehicleId);
      const newPosition: GPS51Position = {
        deviceid: vehicleId,
        callat: position.latitude,
        callon: position.longitude,
        updatetime: new Date(position.timestamp).getTime(),
        speed: position.speed || 0,
        moving: position.ignition_status ? 1 : 0,
        strstatus: position.address || 'Unknown',
        totaldistance: 0,
        course: position.heading || 0,
        altitude: position.altitude || 0,
        radius: position.accuracy || 0,
        fuel: position.fuel_level,
        temp1: position.engine_temperature,
        voltage: position.battery_level
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newPosition;
        return updated;
      } else {
        return [...prev, newPosition];
      }
    });

    // Update last sync time for real-time updates
    setLastSyncTime(new Date());
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setMetrics(prev => ({
      ...prev,
      realTimeConnected: connected,
      lastUpdateTime: connected ? new Date() : prev.lastUpdateTime
    }));
  }, []);

  // Initialize WebSocket connection
  const {
    connected: wsConnected,
    subscribeToVehicles,
    requestVehicleUpdate
  } = useWebSocketConnection({
    autoReconnect: enableWebSocket,
    onPositionUpdate: handlePositionUpdate,
    onConnectionChange: handleConnectionChange
  });

  const fetchLiveData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching live data with Phase 5 optimizations...');

      // Track API usage for cost optimization
      costOptimizationService.trackApiUsage(1);

      // Update scaling metrics
      scalingService.updateMetrics({
        activeVehicles: 0, // Will be updated below
        apiCallsPerMinute: 1,
        averageResponseTime: Date.now(), // Start time for response measurement
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      });

      const startTime = Date.now();

      // Fetch ALL vehicles with their latest positions using LEFT JOIN
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          *,
          vehicle_positions!left(
            *
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) {
        console.error('Error fetching vehicles with positions:', vehiclesError);
        throw vehiclesError;
      }

      console.log('Fetched vehicles data:', vehiclesData?.length || 0, 'vehicles');

      const allVehicles = vehiclesData || [];
      const vehiclesWithPositions = allVehicles.filter(v => 
        Array.isArray(v.vehicle_positions) ? v.vehicle_positions.length > 0 : !!v.vehicle_positions
      );
      const vehiclesWithoutPositions = allVehicles.filter(v => 
        Array.isArray(v.vehicle_positions) ? v.vehicle_positions.length === 0 : !v.vehicle_positions
      );

      // Transform vehicles with positions and apply advanced optimization
      const transformedPositions: GPS51Position[] = [];
      const vehicleIds: string[] = [];
      
      for (const vehicle of vehiclesWithPositions) {
        const positions = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions 
          : [vehicle.vehicle_positions];
        
        if (positions.length > 0) {
          const latestPosition = positions.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];

          // Apply intelligent filtering with cost optimization
          let shouldInclude = true;
          if (enableIntelligentFiltering) {
            const existingPosition = transformedPositions.find(p => p.deviceid === vehicle.gps51_device_id);
            shouldInclude = shouldSyncPosition(vehicle.id, latestPosition, existingPosition);
            
            // Check cache first to reduce API calls
            const cachedPosition = costOptimizationService.getCachedPosition(vehicle.id);
            if (cachedPosition && !shouldInclude) {
              console.log(`Using cached position for vehicle ${vehicle.license_plate}`);
              continue;
            }
            
            // Determine optimal sync frequency with cost consideration
            const frequency = determineUpdateFrequency(
              vehicle.id,
              Number(latestPosition.latitude),
              Number(latestPosition.longitude),
              Number(latestPosition.speed || 0),
              latestPosition.ignition_status || false
            );

            // Advanced analytics tracking
            advancedAnalyticsService.updateVehicleUtilization(vehicle.id, {
              lat: Number(latestPosition.latitude),
              lng: Number(latestPosition.longitude),
              speed: Number(latestPosition.speed || 0),
              timestamp: new Date(latestPosition.timestamp),
              ignitionStatus: latestPosition.ignition_status || false
            });

            console.log(`Vehicle ${vehicle.license_plate}: Update frequency ${frequency}s, Should include: ${shouldInclude}`);
          }

          if (shouldInclude) {
            const gps51Position: GPS51Position = {
              deviceid: vehicle.gps51_device_id || vehicle.license_plate,
              callat: Number(latestPosition.latitude),
              callon: Number(latestPosition.longitude),
              updatetime: new Date(latestPosition.timestamp).getTime(),
              speed: Number(latestPosition.speed || 0),
              moving: latestPosition.ignition_status ? 1 : 0,
              strstatus: latestPosition.address || (latestPosition.ignition_status ? 'Moving' : 'Stopped'),
              totaldistance: 0,
              course: Number(latestPosition.heading || 0),
              altitude: Number(latestPosition.altitude || 0),
              radius: Number(latestPosition.accuracy || 0),
              temp1: latestPosition.engine_temperature ? Number(latestPosition.engine_temperature) : undefined,
              fuel: latestPosition.fuel_level ? Number(latestPosition.fuel_level) : undefined,
              voltage: latestPosition.battery_level ? Number(latestPosition.battery_level) : undefined
            };

            transformedPositions.push(gps51Position);

            // Cache the position for cost optimization
            costOptimizationService.setCachedPosition(vehicle.id, gps51Position, 30000);
          }

          vehicleIds.push(vehicle.id);
        }
      }

      console.log('Transformed positions after Phase 5 filtering:', transformedPositions.length);
      setPositions(transformedPositions);

      // Subscribe to real-time updates for active vehicles if WebSocket is enabled
      if (enableWebSocket && wsConnected && vehicleIds.length > 0) {
        subscribeToVehicles(vehicleIds);
      }

      // Calculate comprehensive fleet metrics with Phase 5 enhancements
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update scaling metrics with actual values
      scalingService.updateMetrics({
        activeVehicles: allVehicles.length,
        apiCallsPerMinute: 1, // This would be accumulated over time
        averageResponseTime: responseTime,
        errorRate: 0,
        memoryUsage: Math.floor(Math.random() * 20) + 60, // Simulated
        cpuUsage: Math.floor(Math.random() * 15) + 40 // Simulated
      });

      const totalDevices = allVehicles.length;
      const vehiclesWithGPS = vehiclesWithPositions.length;
      const vehiclesWithoutGPS = vehiclesWithoutPositions.length;
      
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      const thirtySecondsAgo = now - (30 * 1000);
      
      const activeDevices = transformedPositions.filter(p => 
        p.updatetime > fiveMinutesAgo
      ).length;
      
      const movingVehicles = transformedPositions.filter(p => p.moving === 1).length;
      const parkedDevices = transformedPositions.filter(p => 
        p.moving === 0 && p.updatetime > fiveMinutesAgo
      ).length;
      const offlineVehicles = vehiclesWithGPS - activeDevices;
      const totalDistance = transformedPositions.reduce((sum, p) => sum + p.totaldistance, 0);
      
      const movingDevicesWithSpeed = transformedPositions.filter(p => p.moving === 1 && p.speed > 0);
      const averageSpeed = movingDevicesWithSpeed.length > 0 
        ? movingDevicesWithSpeed.reduce((sum, p) => sum + p.speed, 0) / movingDevicesWithSpeed.length
        : 0;

      const newMetrics: FleetMetrics = {
        totalDevices,
        activeDevices,
        movingVehicles,
        parkedDevices,
        offlineVehicles,
        totalDistance,
        averageSpeed: Math.round(averageSpeed),
        vehiclesWithGPS,
        vehiclesWithoutGPS,
        realTimeConnected: wsConnected,
        lastUpdateTime: new Date()
      };

      setMetrics(newMetrics);
      setLastSyncTime(new Date());

      console.log('Enhanced Phase 5 live data metrics:', newMetrics);
      
      setRetries(0);
    } catch (err) {
      console.error('Error fetching GPS51 live data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      // Update scaling metrics with error
      scalingService.updateMetrics({
        errorRate: (retries + 1) / maxRetries,
        activeVehicles: 0,
        apiCallsPerMinute: 0,
        averageResponseTime: 5000, // High response time for errors
        memoryUsage: 0,
        cpuUsage: 0
      });
      
      if (retries < maxRetries) {
        setRetries(prev => prev + 1);
        setTimeout(fetchLiveData, 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, maxRetries, retries, enableIntelligentFiltering, enableWebSocket, wsConnected, subscribeToVehicles, shouldSyncPosition, determineUpdateFrequency]);

  useEffect(() => {
    if (!enabled) return;

    fetchLiveData();

    // Use intelligent refresh interval
    const interval = setInterval(fetchLiveData, refreshInterval);
    
    return () => {
      clearInterval(interval);
    };
  }, [fetchLiveData, refreshInterval, enabled]);

  const refresh = useCallback(() => {
    console.log('Manually refreshing live data...');
    setRetries(0);
    fetchLiveData();
  }, [fetchLiveData]);

  const triggerPrioritySync = useCallback((vehicleIds: string[]) => {
    if (enableWebSocket && wsConnected) {
      requestVehicleUpdate(vehicleIds);
    }
  }, [enableWebSocket, wsConnected, requestVehicleUpdate]);

  return {
    positions,
    metrics,
    loading,
    error,
    lastSyncTime,
    refresh,
    triggerPrioritySync,
    intelligentFiltering: enableIntelligentFiltering ? {
      getVehiclesByPriority
    } : null,
    // Phase 5 additions
    scalingMetrics: scalingService.getMetrics(),
    budgetStatus: costOptimizationService.getBudgetStatus(),
    optimizationInsights: advancedAnalyticsService.generateOptimizationInsights()
  };
};
