
import { useState, useEffect, useCallback, useRef } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { RealTimeGPS51Data } from '@/services/gps51/types';
import { useGPS51Authentication } from './gps51/useGPS51Authentication';
import { useGPS51DataSync } from './gps51/useGPS51DataSync';
import { useGPS51SyncStatus } from './gps51/useGPS51SyncStatus';

export const useGPS51RealTimeSync = (enableSync: boolean = true) => {
  const [liveData, setLiveData] = useState<RealTimeGPS51Data[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef<boolean>(false);

  const { ensureAuthenticated } = useGPS51Authentication();
  const { fetchLiveData, storeInSupabase } = useGPS51DataSync();
  const { status, setError, setSuccess } = useGPS51SyncStatus();

  const syncGPS51RealTimeData = useCallback(async () => {
    try {
      console.log('🔄 Starting GPS51 real-time sync...');
      
      // Initialize configuration if needed
      if (!initializationRef.current) {
        await gps51ConfigService.initializeFromAuth();
        initializationRef.current = true;
      }

      // Ensure authentication
      await ensureAuthenticated();
      console.log('✅ GPS51 authenticated, fetching live data...');

      // Fetch and transform data
      const transformedData = await fetchLiveData();

      // Update live data state
      setLiveData(transformedData);

      // Store in Supabase
      await storeInSupabase(transformedData);

      // Update status
      setSuccess(transformedData.length);

      console.log(`✅ GPS51 real-time sync completed: ${transformedData.length} positions updated`);

    } catch (error) {
      console.error('❌ GPS51 real-time sync failed:', error);
      setError(error instanceof Error ? error.message : 'Unknown sync error');
    }
  }, [ensureAuthenticated, fetchLiveData, storeInSupabase, setError, setSuccess]);

  // Start/stop real-time sync
  useEffect(() => {
    if (!enableSync) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial sync
    syncGPS51RealTimeData();

    // Set up polling interval (every 30 seconds)
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

  // Initialize configuration on mount
  useEffect(() => {
    gps51ConfigService.initializeFromAuth();
  }, []);

  return {
    status,
    liveData,
    forceSync
  };
};

export type { RealTimeGPS51Data, RealTimeSyncStatus } from '@/services/gps51/types';
