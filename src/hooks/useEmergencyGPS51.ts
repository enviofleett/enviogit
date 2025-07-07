/**
 * EMERGENCY REACT HOOK
 * 2-minute intervals, batch processing, aggressive caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmergencyGPS51Client } from '@/services/gps51/emergency/EmergencyGPS51Client';

interface EmergencyGPS51HookOptions {
  baseUrl: string;
  emergencyRefreshInterval?: number; // Increased to 2 minutes
  maxDevicesPerBatch?: number;
}

export function useEmergencyGPS51({
  baseUrl,
  emergencyRefreshInterval = 120000, // 2 minutes minimum
  maxDevicesPerBatch = 50 // Process ALL devices at once
}: EmergencyGPS51HookOptions) {
  const [client] = useState(() => new EmergencyGPS51Client(baseUrl));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>({});

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  // Emergency login
  const login = useCallback(async (username: string, password: string) => {
    if (loading) return; // Prevent multiple login attempts
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚨 EMERGENCY LOGIN INITIATED');
      await client.login(username, password);
      setIsAuthenticated(true);
      
      // Fetch devices ONCE after login
      const deviceData = await client.getDeviceList(username);
      const allDevices = deviceData.groups?.flatMap((g: any) => g.devices) || [];
      setDevices(allDevices);
      
      console.log(`✅ Emergency login successful. ${allDevices.length} devices loaded.`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Emergency login failed';
      setError(errorMessage);
      console.error('🚨 EMERGENCY LOGIN FAILED:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [client, loading]);

  // Emergency position update - BATCH ALL DEVICES
  const updatePositions = useCallback(async (forceRefresh: boolean = false) => {
    if (isUpdatingRef.current || devices.length === 0 || !isAuthenticated) {
      console.log('⏸️ Update skipped - conditions not met');
      return;
    }

    isUpdatingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log(`🚨 EMERGENCY POSITION UPDATE - ${devices.length} devices in ONE batch`);
      
      const deviceIds = devices.map(d => d.deviceid);
      
      // CRITICAL: Send ALL device IDs in ONE request
      const positionData = await client.getLastPosition(
        deviceIds, 
        lastUpdateRef.current,
        forceRefresh
      );
      
      if (positionData?.records) {
        setPositions(positionData.records);
        lastUpdateRef.current = positionData.lastquerypositiontime || Date.now();
        console.log(`✅ Emergency update successful: ${positionData.records.length} positions`);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Emergency position update failed';
      setError(errorMessage);
      console.error('🚨 EMERGENCY UPDATE FAILED:', errorMessage);
    } finally {
      setLoading(false);
      isUpdatingRef.current = false;
      
      // Update diagnostics
      setDiagnostics(client.getDiagnostics());
    }
  }, [client, devices, isAuthenticated]);

  // Emergency auto-refresh with LONG intervals
  useEffect(() => {
    if (!isAuthenticated || devices.length === 0) {
      return;
    }

    console.log(`🚨 EMERGENCY AUTO-REFRESH: Every ${emergencyRefreshInterval / 1000} seconds`);

    // Initial update
    updatePositions(true);

    // Set up emergency interval
    intervalRef.current = setInterval(() => {
      updatePositions(false); // Use cache when possible
    }, emergencyRefreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, devices.length, emergencyRefreshInterval, updatePositions]);

  // Emergency cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      client.logout();
    };
  }, [client]);

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } finally {
      setIsAuthenticated(false);
      setDevices([]);
      setPositions([]);
      setError(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [client]);

  // Emergency cache clear
  const clearCaches = useCallback(() => {
    client.clearAllCaches();
    setDiagnostics(client.getDiagnostics());
  }, [client]);

  return {
    isAuthenticated,
    loading,
    error,
    devices,
    positions,
    diagnostics,
    login,
    logout,
    updatePositions,
    clearCaches
  };
}