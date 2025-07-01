
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

export const useGPS51LiveSync = (enabled: boolean = true, intervalMs: number = 30000) => {
  const [status, setStatus] = useState<GPS51LiveSyncStatus>({
    isActive: false,
    isConnected: false,
    lastSync: null,
    devicesFound: 0,
    positionsStored: 0,
    errors: [],
    executionTime: 0
  });

  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const performSync = useCallback(async () => {
    if (isRunning || !enabled) {
      return;
    }

    setIsRunning(true);
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting GPS51 live sync...');
      
      const { data, error } = await supabase.functions.invoke('gps51-live-sync', {
        body: { 
          priority: 1,
          batchMode: false,
          cronTriggered: false
        }
      });

      const executionTime = Date.now() - startTime;

      if (error) {
        console.error('GPS51 live sync error:', error);
        setStatus(prev => ({
          ...prev,
          isActive: false,
          isConnected: false,
          errors: [error.message || 'Sync failed'],
          executionTime,
          lastSync: new Date()
        }));
        return;
      }

      if (data?.success) {
        console.log('✅ GPS51 live sync completed:', data);
        setStatus({
          isActive: true,
          isConnected: true,
          lastSync: new Date(),
          devicesFound: data.statistics?.devicesFound || 0,
          positionsStored: data.statistics?.positionsStored || 0,
          errors: [],
          executionTime
        });
      } else {
        console.warn('GPS51 live sync completed with issues:', data);
        setStatus(prev => ({
          ...prev,
          isActive: false,
          isConnected: false,
          errors: data?.errors || ['Sync completed with unknown status'],
          executionTime,
          lastSync: new Date()
        }));
      }

    } catch (error) {
      console.error('❌ GPS51 live sync exception:', error);
      const executionTime = Date.now() - startTime;
      
      setStatus(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        executionTime,
        lastSync: new Date()
      }));
    } finally {
      setIsRunning(false);
    }
  }, [enabled, isRunning]);

  const forceSync = useCallback(() => {
    if (!isRunning) {
      performSync();
    }
  }, [performSync, isRunning]);

  // Set up automatic syncing
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setStatus(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Initial sync
    performSync();

    // Set up interval
    intervalRef.current = setInterval(performSync, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalMs, performSync]);

  return {
    status,
    forceSync,
    isRunning
  };
};
