import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GPS51Position } from '@/hooks/useGPS51LiveData/types';

interface RealTimeSyncState {
  isConnected: boolean;
  lastUpdate: Date | null;
  error: string | null;
  vehicleCount: number;
}

interface GPS51PositionData {
  fuel?: number;
  temp1?: number;
  strstatus?: string;
  [key: string]: any;
}

export const useGPS51RealTimeSync = () => {
  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [retries, setRetries] = useState(0);
  const [metrics, setMetrics] = useState({
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
  const [state, setState] = useState<RealTimeSyncState>({
    isConnected: false,
    lastUpdate: null,
    error: null,
    vehicleCount: 0
  });

  const processPositionData = useCallback((rawData: any): GPS51Position => {
    const data = rawData as GPS51PositionData;
    
    return {
      deviceid: data.deviceid || '',
      callat: data.callat || 0,
      callon: data.callon || 0,
      updatetime: data.updatetime || Date.now(),
      speed: data.speed || 0,
      moving: data.moving || 0,
      strstatus: data.strstatus || 'Unknown',
      totaldistance: data.totaldistance || 0,
      course: data.course || 0,
      altitude: data.altitude || 0,
      radius: data.radius || 0,
      temp1: data.temp1,
      temp2: data.temp2,
      voltage: data.voltage,
      fuel: data.fuel
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Simulate real-time connection
      setState(prev => ({ 
        ...prev, 
        isConnected: true,
        lastUpdate: new Date()
      }));
      
      console.log('GPS51 real-time sync connected');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isConnected: false 
      }));
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      lastUpdate: null,
      error: null,
      vehicleCount: 0
    });
    console.log('GPS51 real-time sync disconnected');
  }, []);

  const getState = useCallback(() => state, [state]);

  return {
    connect,
    disconnect,
    getState,
    processPositionData
  };
};
