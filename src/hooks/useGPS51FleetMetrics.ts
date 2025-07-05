import { useMemo } from 'react';

interface LiveDataState {
  devices: any[];
  positions: any[];
  lastUpdate: Date | null;
}

export const useGPS51FleetMetrics = (liveData: LiveDataState) => {
  return useMemo(() => {
    if (!liveData || !liveData.devices) {
      return {
        totalVehicles: 0,
        activeVehicles: 0,
        inactiveVehicles: 0,
        lastUpdate: null
      };
    }

    const devices = liveData.devices;
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);

    const activeVehicles = devices.filter(device => {
      const lastActiveTime = device.lastactivetime || 0;
      return lastActiveTime > thirtyMinutesAgo;
    }).length;

    return {
      totalVehicles: devices.length,
      activeVehicles,
      inactiveVehicles: devices.length - activeVehicles,
      lastUpdate: liveData.lastUpdate
    };
  }, [liveData]);
};