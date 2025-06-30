
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { gps51RequestManager } from '@/services/gps51/GPS51RequestManager';
import { gps51SmartPolling } from '@/services/gps51/GPS51SmartPolling';

export interface GPS51SmartSyncStatus {
  isActive: boolean;
  isConnected: boolean;
  lastSync: Date | null;
  devicesFound: number;
  positionsStored: number;
  errors: string[];
  executionTime: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  requestQueueLength: number;
  adaptiveInterval: number;
}

export interface GPS51SmartSyncResult {
  success: boolean;
  devicesFound: number;
  activeDevices: number;
  positionsRetrieved: number;
  positionsStored: number;
  errors: string[];
  executionTimeMs: number;
  batchesProcessed: number;
}

export const useGPS51SmartSync = (enableSync: boolean = true) => {
  const [status, setStatus] = useState<GPS51SmartSyncStatus>({
    isActive: false,
    isConnected: false,
    lastSync: null,
    devicesFound: 0,
    positionsStored: 0,
    errors: [],
    executionTime: 0,
    systemHealth: 'excellent',
    requestQueueLength: 0,
    adaptiveInterval: 30000
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const performSmartSync = useCallback(async () => {
    if (isRunningRef.current) {
      console.log('GPS51 smart sync already running, skipping...');
      return;
    }

    isRunningRef.current = true;
    
    try {
      console.log('🔄 Starting GPS51 smart sync...');
      
      // Use request manager to queue the sync operation
      const result = await gps51RequestManager.queueRequest(
        async () => {
          const { data, error } = await supabase.functions.invoke('gps51-live-sync');
          
          if (error) {
            throw new Error(`Edge function error: ${error.message}`);
          }
          
          return data as GPS51SmartSyncResult;
        },
        { priority: 'high', retries: 2 }
      );

      console.log('GPS51 smart sync result:', result);

      // Get system health status
      const requestManagerHealth = gps51RequestManager.getHealthStatus();
      const pollingSettings = gps51SmartPolling.getOptimalPollingSettings();
      
      // Calculate adaptive interval based on results
      const hasNewData = result.positionsStored > 0;
      const adaptiveInterval = gps51SmartPolling.calculateAdaptiveInterval(hasNewData);

      setStatus(prev => ({
        ...prev,
        isActive: true,
        isConnected: result.success,
        lastSync: new Date(),
        devicesFound: result.devicesFound,
        positionsStored: result.positionsStored,
        errors: result.errors || [],
        executionTime: result.executionTimeMs,
        systemHealth: pollingSettings.systemHealth,
        requestQueueLength: requestManagerHealth.queueLength,
        adaptiveInterval
      }));

      // Update polling interval for next sync
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(performSmartSync, adaptiveInterval);
      }

      if (!result.success) {
        console.error('GPS51 smart sync failed:', result.errors);
      } else {
        console.log(`✅ GPS51 smart sync completed: ${result.positionsStored} positions stored from ${result.devicesFound} devices in ${result.batchesProcessed} batches`);
      }

    } catch (error) {
      console.error('❌ GPS51 smart sync error:', error);
      
      const requestManagerHealth = gps51RequestManager.getHealthStatus();
      
      setStatus(prev => ({
        ...prev,
        isActive: false,
        isConnected: false,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
        systemHealth: requestManagerHealth.isHealthy ? 'fair' : 'poor',
        requestQueueLength: requestManagerHealth.queueLength
      }));
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  // Start/stop smart sync based on enableSync flag
  useEffect(() => {
    if (!enableSync) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setStatus(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Get optimal polling settings
    const pollingSettings = gps51SmartPolling.getOptimalPollingSettings();
    const initialInterval = pollingSettings.recommendedInterval;

    // Initial sync
    performSmartSync();

    // Set up adaptive polling interval
    intervalRef.current = setInterval(performSmartSync, initialInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableSync, performSmartSync]);

  // Update status with real-time system health
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      const requestManagerHealth = gps51RequestManager.getHealthStatus();
      const pollingSettings = gps51SmartPolling.getOptimalPollingSettings();
      
      setStatus(prev => ({
        ...prev,
        systemHealth: pollingSettings.systemHealth,
        requestQueueLength: requestManagerHealth.queueLength,
        adaptiveInterval: gps51SmartPolling.getCurrentInterval()
      }));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(healthCheckInterval);
  }, []);

  const forceSync = useCallback(() => {
    performSmartSync();
  }, [performSmartSync]);

  const emergencyPause = useCallback(() => {
    gps51RequestManager.pauseAllRequests();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus(prev => ({ ...prev, isActive: false, systemHealth: 'poor' }));
  }, []);

  const emergencyResume = useCallback(() => {
    gps51RequestManager.resumeRequests();
    gps51SmartPolling.resetInterval();
    
    if (enableSync) {
      const pollingSettings = gps51SmartPolling.getOptimalPollingSettings();
      intervalRef.current = setInterval(performSmartSync, pollingSettings.recommendedInterval);
      setStatus(prev => ({ ...prev, isActive: true }));
    }
  }, [enableSync, performSmartSync]);

  const adjustRateLimit = useCallback((maxRequestsPerMinute: number, minDelayBetweenRequests: number) => {
    gps51RequestManager.adjustRateLimit({
      maxRequestsPerMinute,
      minDelayBetweenRequests
    });
  }, []);

  return {
    status,
    forceSync,
    emergencyPause,
    emergencyResume,
    adjustRateLimit,
    isRunning: isRunningRef.current
  };
}
