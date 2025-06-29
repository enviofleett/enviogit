
import { useState, useEffect, useCallback, useRef } from 'react';
import { GPS51DataService } from '@/services/gps51/GPS51DataService';
import { GPS51SyncService } from '@/services/gps51/GPS51SyncService';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const syncGPS51RealTimeData = useCallback(async () => {
    try {
      console.log('🔄 Starting GPS51 real-time sync with new database structure...');
      
      // Perform scheduled sync using the new service
      const result = await GPS51SyncService.performScheduledSync();
      
      if (!result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      // Get latest positions from the new positions table
      const { data: latestPositions, error } = await supabase
        .from('positions')
        .select(`
          *,
          devices!inner(device_id, device_name, assigned_user_id)
        `)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Transform to our live data format
      const transformedData: RealTimeGPS51Data[] = (latestPositions || []).map(pos => ({
        deviceId: pos.device_id,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed_kph || 0,
        course: pos.heading || 0,
        timestamp: new Date(pos.timestamp),
        ignitionStatus: pos.ignition_on || false,
        fuel: pos.raw_data?.fuel,
        temperature: pos.raw_data?.temp1,
        address: pos.raw_data?.strstatus || 'Unknown'
      }));

      // Filter to unique devices (latest position per device)
      const uniqueDevices = new Map();
      transformedData.forEach(pos => {
        const existing = uniqueDevices.get(pos.deviceId);
        if (!existing || new Date(pos.timestamp) > new Date(existing.timestamp)) {
          uniqueDevices.set(pos.deviceId, pos);
        }
      });

      const livePositions = Array.from(uniqueDevices.values());
      setLiveData(livePositions);

      // Update status
      setStatus(prev => ({
        ...prev,
        isActive: true,
        isConnected: true,
        lastUpdate: new Date(),
        activeDevices: livePositions.length,
        error: null
      }));

      console.log(`✅ GPS51 real-time sync completed: ${livePositions.length} active devices`);

    } catch (error) {
      console.error('❌ GPS51 real-time sync failed:', error);
      setStatus(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown sync error'
      }));
      
      toast({
        title: "GPS51 Sync Error",
        description: error instanceof Error ? error.message : 'Failed to sync GPS51 data',
        variant: "destructive",
      });
    }
  }, [toast]);

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
    console.log('🔄 Manual GPS51 sync triggered...');
    syncGPS51RealTimeData();
  }, [syncGPS51RealTimeData]);

  return {
    status,
    liveData,
    forceSync
  };
};
