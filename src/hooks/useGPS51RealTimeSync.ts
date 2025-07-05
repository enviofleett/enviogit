import { useState, useCallback } from 'react';

export interface RealTimeGPS51Data {
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  timestamp: Date;
  ignitionStatus: boolean;
  fuel?: number;
  temperature?: number;
  address?: string;
}

export interface RealTimeSyncStatus {
  isActive: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  activeDevices: number;
  error: string | null;
}

// Stub implementation until database schema is ready
export const useGPS51RealTimeSync = (enableSync: boolean = true) => {
  const [status, setStatus] = useState<RealTimeSyncStatus>({
    isActive: false,
    isConnected: false,
    lastUpdate: null,
    activeDevices: 0,
    error: 'Database schema pending - real-time sync temporarily disabled'
  });

  const [liveData, setLiveData] = useState<RealTimeGPS51Data[]>([]);

  const forceSync = useCallback(() => {
    console.log('GPS51 Real-time sync temporarily disabled - database schema pending');
  }, []);

  return {
    status,
    liveData,
    forceSync
  };
};