import { useMemo } from 'react';

interface LiveDataState {
  devices: any[];
  positions: any[];
  lastUpdate: Date | null;
}

export const useGPS51VehicleData = (liveData: LiveDataState) => {
  return useMemo(() => {
    if (!liveData || !liveData.devices) {
      return [];
    }

    return liveData.devices.map(device => ({
      id: device.deviceid || device.id,
      name: device.devicename || device.name || 'Unknown Vehicle',
      status: device.strstatus || 'unknown',
      lastUpdate: device.lastactivetime ? new Date(device.lastactivetime) : null,
      latitude: device.latitude,
      longitude: device.longitude
    }));
  }, [liveData]);
};