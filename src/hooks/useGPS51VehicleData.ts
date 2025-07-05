
import { useMemo } from 'react';
import { LiveDataState } from '@/services/gps51/GPS51LiveDataService';
import { GPS51Device, GPS51Position } from '@/services/gps51/types';

export interface VehicleWithEnhancedData {
  device: GPS51Device;
  position?: GPS51Position;
  isOnline: boolean;
  isMoving: boolean;
  hasAlarms: boolean;
  fuelLevel?: number;
  temperature?: number;
  batteryLevel?: number;
  lastSeen: Date | null;
}

export const useGPS51VehicleData = (liveData: LiveDataState): VehicleWithEnhancedData[] => {
  return useMemo(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    return liveData.devices.map(device => {
      const position = liveData.positions.find(p => p.deviceid === device.deviceid);
      
      return {
        device,
        position,
        isOnline: position ? position.updatetime > fiveMinutesAgo : false,
        isMoving: position ? position.moving === 1 : false,
        hasAlarms: position ? (position.alarm || 0) > 0 : false,
        fuelLevel: position?.totaloil,
        temperature: position?.temp1,
        batteryLevel: position?.voltagepercent,
        lastSeen: position ? new Date(position.updatetime) : null
      };
    });
  }, [liveData]);
};
