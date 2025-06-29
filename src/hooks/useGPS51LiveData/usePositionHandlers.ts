
import { useCallback } from 'react';
import { GPS51Position } from './types';

export const usePositionHandlers = (
  setPositions: React.Dispatch<React.SetStateAction<GPS51Position[]>>,
  setLastSyncTime: React.Dispatch<React.SetStateAction<Date | null>>,
  setMetrics: React.Dispatch<React.SetStateAction<any>>
) => {
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

    setLastSyncTime(new Date());
  }, [setPositions, setLastSyncTime]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setMetrics(prev => ({
      ...prev,
      realTimeConnected: connected,
      lastUpdateTime: connected ? new Date() : prev.lastUpdateTime
    }));
  }, [setMetrics]);

  return {
    handlePositionUpdate,
    handleConnectionChange
  };
};
