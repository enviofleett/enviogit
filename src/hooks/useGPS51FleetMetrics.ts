
import { useMemo } from 'react';
import { LiveDataState } from '@/services/gps51/GPS51LiveDataService';

export interface EnhancedFleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedVehicles: number;
  offlineVehicles: number;
  totalDistance: number;
  averageSpeed: number;
  devicesWithAlarms: number;
  fuelAlerts: number;
  temperatureAlerts: number;
  lastUpdateTime: Date | null;
  dataFreshness: 'live' | 'stale' | 'offline';
}

export const useGPS51FleetMetrics = (liveData: LiveDataState): EnhancedFleetMetrics => {
  return useMemo(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const devicesWithPositions = liveData.devices.map(device => {
      const position = liveData.positions.find(p => p.deviceid === device.deviceid);
      return { device, position };
    });

    const activeDevices = devicesWithPositions.filter(({ position }) => 
      position && position.updatetime > fiveMinutesAgo
    ).length;

    const movingVehicles = devicesWithPositions.filter(({ position }) => 
      position && position.moving === 1
    ).length;

    const parkedVehicles = devicesWithPositions.filter(({ position }) => 
      position && position.moving === 0 && position.updatetime > fiveMinutesAgo
    ).length;

    const offlineVehicles = liveData.devices.length - activeDevices;

    const totalDistance = liveData.positions.reduce((sum, position) => 
      sum + (position.totaldistance || 0), 0
    );

    const movingPositions = liveData.positions.filter(p => p.moving === 1 && p.speed > 0);
    const averageSpeed = movingPositions.length > 0 
      ? movingPositions.reduce((sum, p) => sum + p.speed, 0) / movingPositions.length
      : 0;

    const devicesWithAlarms = liveData.positions.filter(p => p.alarm && p.alarm > 0).length;
    
    const fuelAlerts = liveData.positions.filter(p => 
      p.totaloil !== undefined && p.totaloil < 20
    ).length;

    const temperatureAlerts = liveData.positions.filter(p => 
      (p.temp1 !== undefined && p.temp1 > 80) ||
      (p.temp2 !== undefined && p.temp2 > 80)
    ).length;

    const dataAge = now - liveData.lastUpdate.getTime();
    let dataFreshness: 'live' | 'stale' | 'offline' = 'offline';
    if (dataAge < 60000) dataFreshness = 'live'; // Less than 1 minute
    else if (dataAge < 300000) dataFreshness = 'stale'; // Less than 5 minutes

    return {
      totalDevices: liveData.devices.length,
      activeDevices,
      movingVehicles,
      parkedVehicles,
      offlineVehicles,
      totalDistance: Math.round(totalDistance / 1000), // Convert to km
      averageSpeed: Math.round(averageSpeed),
      devicesWithAlarms,
      fuelAlerts,
      temperatureAlerts,
      lastUpdateTime: liveData.lastUpdate,
      dataFreshness
    };
  }, [liveData]);
};
