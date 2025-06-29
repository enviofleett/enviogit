
import { useState, useEffect, useCallback } from 'react';
import { GPS51DataService, GPS51User, GPS51Device, GPS51Position } from '@/services/gps51/GPS51DataService';
import { useToast } from '@/hooks/use-toast';

export interface UseGPS51DataOptions {
  userId?: string;
  deviceId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useGPS51Data = (options: UseGPS51DataOptions = {}) => {
  const { userId, deviceId, autoRefresh = false, refreshInterval = 30000 } = options;
  
  const [user, setUser] = useState<GPS51User | null>(null);
  const [devices, setDevices] = useState<GPS51Device[]>([]);
  const [positions, setPositions] = useState<GPS51Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Load user data
  const loadUser = useCallback(async (username: string) => {
    try {
      setLoading(true);
      const userData = await GPS51DataService.getUserByUsername(username);
      setUser(userData);
      return userData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load user';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load devices for user
  const loadDevices = useCallback(async (userIdToLoad?: string) => {
    if (!userIdToLoad && !userId) return;
    
    try {
      setLoading(true);
      const devicesData = await GPS51DataService.getUserDevices(userIdToLoad || userId!);
      setDevices(devicesData);
      return devicesData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load devices';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  // Load positions for device or devices
  const loadPositions = useCallback(async (deviceIds?: string[], limit = 100) => {
    const idsToLoad = deviceIds || (deviceId ? [deviceId] : devices.map(d => d.device_id));
    if (idsToLoad.length === 0) return;

    try {
      setLoading(true);
      const positionsData = await GPS51DataService.getLatestPositions(idsToLoad);
      setPositions(positionsData);
      return positionsData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load positions';
      setError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [deviceId, devices, toast]);

  // Get latest position for a specific device
  const getLatestPosition = useCallback(async (targetDeviceId: string) => {
    try {
      return await GPS51DataService.getLatestPositionForDevice(targetDeviceId);
    } catch (err) {
      console.error('Failed to get latest position:', err);
      return null;
    }
  }, []);

  // Get historical positions for a device
  const getHistoricalPositions = useCallback(async (
    targetDeviceId: string,
    startTime?: string,
    endTime?: string,
    limit = 100
  ) => {
    try {
      return await GPS51DataService.getDevicePositions(targetDeviceId, limit, startTime, endTime);
    } catch (err) {
      console.error('Failed to get historical positions:', err);
      return [];
    }
  }, []);

  // Refresh all data
  const refresh = useCallback(async () => {
    if (userId) {
      const devicesData = await loadDevices(userId);
      if (devicesData && devicesData.length > 0) {
        await loadPositions(devicesData.map(d => d.device_id));
      }
    }
  }, [userId, loadDevices, loadPositions]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && userId) {
      refresh();
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, userId, refreshInterval, refresh]);

  // Initial load effect
  useEffect(() => {
    if (userId) {
      loadDevices(userId);
    }
  }, [userId, loadDevices]);

  return {
    user,
    devices,
    positions,
    loading,
    error,
    loadUser,
    loadDevices,
    loadPositions,
    getLatestPosition,
    getHistoricalPositions,
    refresh,
    // Helper methods
    getDeviceById: useCallback((id: string) => devices.find(d => d.device_id === id), [devices]),
    getPositionsForDevice: useCallback((id: string) => positions.filter(p => p.device_id === id), [positions]),
    getActiveDevices: useCallback(() => devices.filter(d => d.last_seen_at && 
      new Date(d.last_seen_at).getTime() > Date.now() - 5 * 60 * 1000), [devices])
  };
};
