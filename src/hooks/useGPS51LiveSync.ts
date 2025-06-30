
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GPS51LiveSyncStatus {
  isActive: boolean;
  isConnected: boolean;
  lastSync: Date | null;
  devicesFound: number;
  positionsStored: number;
  errors: string[];
  executionTime: number;
}

export interface GPS51LiveSyncResult {
  success: boolean;
  devicesFound: number;
  activeDevices: number;
  positionsRetrieved: number;
  positionsStored: number;
  errors: string[];
  executionTimeMs: number;
}

export const useGPS51LiveSync = (enableSync: boolean = true, intervalMs: number = 30000) => {
  const [status, setStatus] = useState<GPS51LiveSyncStatus>({
    isActive: false,
    isConnected: false,
    lastSync: null,
    devicesFound: 0,
    positionsStored: 0,
    errors: [],
    executionTime: 0
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const performSync = useCallback(async () => {
    if (isRunningRef.current) {
      console.log('GPS51 sync already running, skipping...');
      return;
    }

    isRunningRef.current = true;
    
    try {
      console.log('🔄 Starting GPS51 live sync...');
      
      const { data, error } = await supabase.functions.invoke('gps51-live-sync');
      
      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      const result = data as GPS51LiveSyncResult;
      console.log('GPS51 sync result:', result);

      setStatus(prev => ({
        ...prev,
        isActive: true,
        isConnected: result.success,
        lastSync: new Date(),
        devicesFound: result.devicesFound,
        positionsStored: result.positionsStored,
        errors: result.errors || [],
        executionTime: result.executionTimeMs
      }));

      if (!result.success) {
        console.error('GPS51 sync failed:', result.errors);
      } else {
        console.log(`✅ GPS51 sync completed: ${result.positionsStored} positions stored from ${result.devicesFound} devices`);
      }

    } catch (error) {
      console.error('❌ GPS51 sync error:', error);
      setStatus(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      }));
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  // Start/stop sync based on enableSync flag
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
    performSync();

    // Set up polling interval
    intervalRef.current = setInterval(performSync, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableSync, intervalMs, performSync]);

  const forceSync = useCallback(() => {
    performSync();
  }, [performSync]);

  return {
    status,
    forceSync,
    isRunning: isRunningRef.current
  };
};
