
import { useCallback } from 'react';
import { useGPS51LiveDataState } from './useGPS51LiveDataState';
import { useGPS51FleetMetrics } from './useGPS51FleetMetrics';
import { useGPS51VehicleData } from './useGPS51VehicleData';
import { useGPS51LiveDataPolling } from './useGPS51LiveDataPolling';

export interface LiveDataOptions {
  enabled?: boolean;
  pollingInterval?: number;
  maxRetries?: number;
  autoStart?: boolean;
}

export const useGPS51LiveDataEnhanced = (options: LiveDataOptions = {}) => {
  const {
    liveData,
    loading,
    error,
    updateLiveData,
    setLoadingState,
    setErrorState
  } = useGPS51LiveDataState();

  const metrics = useGPS51FleetMetrics(liveData);
  const vehicles = useGPS51VehicleData(liveData);

  const {
    refresh,
    startPolling,
    stopPolling,
    service
  } = useGPS51LiveDataPolling(
    options,
    updateLiveData,
    setErrorState,
    setLoadingState
  );

  // Get device by ID
  const getDeviceById = useCallback((deviceId: string) => {
    return service.getDeviceById(deviceId);
  }, [service]);

  // Get position by device ID
  const getPositionByDeviceId = useCallback((deviceId: string) => {
    return service.getPositionByDeviceId(deviceId);
  }, [service]);

  return {
    // Data
    liveData,
    metrics,
    vehicles,
    
    // State
    loading,
    error,
    
    // Actions
    refresh,
    startPolling,
    stopPolling,
    
    // Utilities
    getDeviceById,
    getPositionByDeviceId,
    
    // Service instance (for advanced usage)
    service
  };
};
