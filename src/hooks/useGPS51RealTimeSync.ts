
import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { gps51Client } from '@/services/gps51/GPS51Client';
import { supabase } from '@/integrations/supabase/client';

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

export const useGPS51RealTimeSync = (enableSync: boolean = true) => {
  const [status, setStatus] = useState<RealTimeSyncStatus>({
    isActive: false,
    isConnected: false,
    lastUpdate: null,
    activeDevices: 0,
    error: null
  });

  const [liveData, setLiveData] = useState<RealTimeGPS51Data[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const authService = GPS51AuthService.getInstance();

  const syncGPS51RealTimeData = useCallback(async () => {
    try {
      console.log('🔄 Starting GPS51 real-time sync...');
      
      // Verify GPS51 connection and credentials
      const isConfigured = gps51ConfigService.isConfigured();
      if (!isConfigured) {
        throw new Error('GPS51 not configured. Please set up credentials.');
      }

      const isAuthenticated = authService.isAuthenticated();
      if (!isAuthenticated) {
        throw new Error('GPS51 authentication required. Please reconnect.');
      }

      // Get valid token for GPS51 API calls
      const token = await authService.getValidToken();
      if (!token) {
        throw new Error('No valid GPS51 token available.');
      }

      console.log('✅ GPS51 authenticated, fetching live data...');

      // Fetch device list from GPS51
      const devices = await gps51Client.getDeviceList();
      console.log(`📱 Found ${devices.length} GPS51 devices`);

      if (devices.length === 0) {
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          activeDevices: 0,
          lastUpdate: new Date(),
          error: null
        }));
        return;
      }

      // Get real-time positions from GPS51
      const deviceIds = devices.map(d => d.deviceid);
      const { positions } = await gps51Client.getRealtimePositions(deviceIds);
      console.log(`📍 Received ${positions.length} live positions from GPS51`);

      // Transform GPS51 data to our format
      const transformedData: RealTimeGPS51Data[] = positions.map(pos => ({
        deviceId: pos.deviceid,
        latitude: pos.callat,
        longitude: pos.callon,
        speed: pos.speed,
        course: pos.course,
        timestamp: new Date(pos.updatetime),
        ignitionStatus: pos.moving === 1,
        fuel: pos.fuel,
        temperature: pos.temp1,
        address: pos.strstatus
      }));

      // Update live data state
      setLiveData(transformedData);

      // Store positions in Supabase for dashboard display
      await storePositionsInSupabase(transformedData);

      // Update status
      setStatus(prev => ({
        ...prev,
        isActive: true,
        isConnected: true,
        lastUpdate: new Date(),
        activeDevices: transformedData.length,
        error: null
      }));

      console.log(`✅ GPS51 real-time sync completed: ${transformedData.length} positions updated`);

    } catch (error) {
      console.error('❌ GPS51 real-time sync failed:', error);
      setStatus(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      }));
    }
  }, [authService]);

  const storePositionsInSupabase = async (positions: RealTimeGPS51Data[]) => {
    for (const position of positions) {
      try {
        // Find vehicle by GPS51 device ID
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('id')
          .eq('gps51_device_id', position.deviceId)
          .single();

        if (vehicle) {
          // Insert real-time position
          await supabase
            .from('vehicle_positions')
            .insert({
              vehicle_id: vehicle.id,
              device_id: position.deviceId,
              latitude: position.latitude,
              longitude: position.longitude,
              speed: position.speed,
              heading: position.course,
              timestamp: position.timestamp.toISOString(),
              fuel_level: position.fuel,
              engine_temperature: position.temperature,
              address: position.address
            });
        }
      } catch (error) {
        console.warn(`Failed to store position for device ${position.deviceId}:`, error);
      }
    }
  };

  // Start/stop real-time sync
  useEffect(() => {
    if (!enableSync) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setStatus(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Initial sync
    syncGPS51RealTimeData();

    // Set up polling interval (every 30 seconds for real-time updates)
    intervalRef.current = setInterval(syncGPS51RealTimeData, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableSync, syncGPS51RealTimeData]);

  const forceSync = useCallback(() => {
    syncGPS51RealTimeData();
  }, [syncGPS51RealTimeData]);

  return {
    status,
    liveData,
    forceSync
  };
};
