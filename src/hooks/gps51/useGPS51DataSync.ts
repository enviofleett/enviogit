
import { useCallback } from 'react';
import { gps51Client } from '@/services/gps51/GPS51Client';
import { supabase } from '@/integrations/supabase/client';
import { RealTimeGPS51Data } from '@/services/gps51/types';

export const useGPS51DataSync = () => {
  const fetchLiveData = useCallback(async (): Promise<RealTimeGPS51Data[]> => {
    console.log('📱 Fetching GPS51 devices...');
    
    // Fetch device list
    const devices = await gps51Client.getDeviceList();
    console.log(`📱 Found ${devices.length} GPS51 devices`);

    if (devices.length === 0) {
      return [];
    }

    // Get real-time positions
    const deviceIds = devices.map(d => d.deviceid);
    const positions = await gps51Client.getRealtimePositions(deviceIds);
    console.log(`📍 Received ${positions.length} live positions from GPS51`);

    // Transform data
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

    return transformedData;
  }, []);

  const storeInSupabase = useCallback(async (positions: RealTimeGPS51Data[]) => {
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
              latitude: position.latitude,
              longitude: position.longitude,
              speed: position.speed,
              heading: position.course,
              timestamp: position.timestamp.toISOString(),
              ignition_status: position.ignitionStatus,
              fuel_level: position.fuel,
              engine_temperature: position.temperature,
              address: position.address,
              recorded_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.warn(`Failed to store position for device ${position.deviceId}:`, error);
      }
    }
  }, []);

  return {
    fetchLiveData,
    storeInSupabase
  };
};
