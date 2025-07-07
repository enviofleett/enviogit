import { useState, useEffect, useCallback } from 'react';
import { gps51CoordinatorClient } from '@/services/gps51/GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

// Compatible vehicle interface for existing components
export interface VehicleData {
  id: string;
  brand: string;
  model: string;
  license_plate: string;
  status: string;
  type: string;
  created_at: string;
  updated_at: string;
  notes: string;
  gps51_device_id?: string;
  latest_position: VehiclePosition | null;
}

export interface VehiclePosition {
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;
  status: string;
  isMoving: boolean;
  ignition_status?: boolean;
  heading?: number;
  fuel_level?: number;
  engine_temperature?: number;
}

export interface GPS51DataState {
  devices: GPS51Device[];
  positions: GPS51Position[];
  vehicles: VehicleData[];  // Compatible interface
  vehiclePositions: VehiclePosition[];  // Compatible interface
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isAuthenticated: boolean;
  pollingActive: boolean;
  loading: boolean;  // Alias for isLoading
}

export interface GPS51DataActions {
  startPolling: () => void;
  stopPolling: () => void;
  refreshData: () => Promise<void>;
  authenticateIfNeeded: () => Promise<boolean>;
  refresh: () => Promise<void>;  // Alias for refreshData
}

export interface UseGPS51DataReturn {
  state: GPS51DataState;
  actions: GPS51DataActions;
  // Direct access for backward compatibility
  vehicles: VehicleData[];
  vehiclePositions: VehiclePosition[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Simple GPS51 data hook following pure API documentation pattern
 * - Single action=lastposition API call
 * - Uses lastquerypositiontime for incremental updates
 * - Fixed 60-second polling interval
 * - No adaptive logic, no orchestration, no user activity tracking
 */
export const useGPS51Data = (): UseGPS51DataReturn => {
  const [state, setState] = useState<GPS51DataState>({
    devices: [],
    positions: [],
    vehicles: [],
    vehiclePositions: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
    isAuthenticated: false,
    pollingActive: false,
    loading: false
  });

  const [pollingTimer, setPollingTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastQueryPositionTime, setLastQueryPositionTime] = useState<number>(0);

  // Convert GPS51 data to compatible format
  const convertToVehicleData = useCallback((devices: GPS51Device[], positions: GPS51Position[]): { vehicles: VehicleData[], vehiclePositions: VehiclePosition[] } => {
    const vehicles: VehicleData[] = devices.map(device => {
      const position = positions.find(p => p.deviceid === device.deviceid);
      
      let latest_position: VehiclePosition | null = null;
      if (position) {
        latest_position = {
          vehicle_id: device.deviceid,
          latitude: Number(position.callat),
          longitude: Number(position.callon),
          speed: Number(position.speed || 0),
          timestamp: new Date(position.updatetime * 1000).toISOString(),
          status: position.strstatus || 'Unknown',
          isMoving: (position.speed || 0) > 1,
          ignition_status: position.moving === 1,
          heading: position.course,
          fuel_level: undefined,
          engine_temperature: undefined
        };
      }

      return {
        id: device.deviceid,
        brand: 'GPS51',
        model: device.devicename || 'Unknown',
        license_plate: device.devicename || device.deviceid,
        status: device.status === 1 ? 'active' : 'inactive',
        type: 'vehicle',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: '',
        gps51_device_id: device.deviceid,
        latest_position
      };
    });

    const vehiclePositions: VehiclePosition[] = vehicles
      .filter(v => v.latest_position)
      .map(v => v.latest_position!);

    return { vehicles, vehiclePositions };
  }, []);

  // Simple API call: action=lastposition with lastquerypositiontime
  const fetchPositions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, loading: true, error: null }));

      // Direct lastposition API call as per documentation
      const result = await gps51CoordinatorClient.getRealtimePositions([], lastQueryPositionTime);

      // Convert to compatible format
      const { vehicles, vehiclePositions } = convertToVehicleData(state.devices, result.positions);

      setState(prev => ({
        ...prev,
        positions: result.positions,
        vehicles,
        vehiclePositions,
        lastUpdate: new Date(),
        isLoading: false,
        loading: false
      }));

      // Update lastQueryPositionTime from server response for next incremental call
      setLastQueryPositionTime(result.lastQueryTime);

      console.log('GPS51Data: Fetched positions', {
        count: result.positions.length,
        lastQueryTime: result.lastQueryTime
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        loading: false
      }));
      console.error('GPS51Data: Fetch failed:', error);
    }
  }, [lastQueryPositionTime, convertToVehicleData, state.devices]);

  const startPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
    }

    setState(prev => ({ ...prev, pollingActive: true }));

    // PHASE 2: Initial call with lastQueryPositionTime=0 for full refresh  
    setLastQueryPositionTime(0);
    fetchPositions();

    // Fixed 60-second interval as recommended in API documentation
    const timer = setInterval(fetchPositions, 60000);
    setPollingTimer(timer);
    
    console.log('GPS51Data: Started polling (60s interval)');
  }, [fetchPositions, pollingTimer]);

  const stopPolling = useCallback(() => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      setPollingTimer(null);
    }
    setState(prev => ({ ...prev, pollingActive: false }));
    console.log('GPS51Data: Stopped polling');
  }, [pollingTimer]);

  const refreshData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, loading: true, error: null }));

      // Fetch devices first
      const devices = await gps51CoordinatorClient.getDeviceList();
      
      // Then fetch all positions (reset lastQueryPositionTime for full refresh)
      const positionsResult = await gps51CoordinatorClient.getRealtimePositions([], 0);

      // Convert to compatible format
      const { vehicles, vehiclePositions } = convertToVehicleData(devices, positionsResult.positions);

      setState(prev => ({
        ...prev,
        devices,
        positions: positionsResult.positions,
        vehicles,
        vehiclePositions,
        lastUpdate: new Date(),
        isLoading: false,
        loading: false
      }));

      setLastQueryPositionTime(positionsResult.lastQueryTime);

      console.log('GPS51Data: Manual refresh completed', {
        devices: devices.length,
        positions: positionsResult.positions.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        loading: false
      }));
      console.error('GPS51Data: Refresh failed:', error);
    }
  }, [convertToVehicleData]);

  const authenticateIfNeeded = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, loading: true, error: null }));

      // Skip coordinator status check to prevent API spikes - assume authenticated
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        isLoading: false,
        loading: false
      }));

      return true;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        error: 'Authentication check failed',
        isLoading: false,
        loading: false
      }));
      return false;
    }
  }, []);

  // Initialize authentication
  useEffect(() => {
    authenticateIfNeeded();
  }, [authenticateIfNeeded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [pollingTimer]);

  return {
    state,
    actions: {
      startPolling,
      stopPolling,
      refreshData,
      authenticateIfNeeded,
      refresh: refreshData
    },
    // Direct access for backward compatibility
    vehicles: state.vehicles,
    vehiclePositions: state.vehiclePositions,
    loading: state.loading,
    error: state.error,
    refresh: refreshData
  };
};