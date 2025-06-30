
import { useState, useEffect, useCallback } from 'react';
import { gps51RealTimeActivationService } from '@/services/gps51/GPS51RealTimeActivationService';

export const useGPS51RealTimeActivation = () => {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activePolling: false,
    webSocketConnected: false,
    lastActivation: null as Date | null,
    pollingInterval: 30000,
    priority1Vehicles: 0,
    priority2Vehicles: 0,
    priority3Vehicles: 0,
    priority4Vehicles: 0
  });
  
  const [systemHealth, setSystemHealth] = useState({
    polling: false,
    webSocket: false,
    lastUpdate: null as Date | null,
    vehicleCount: 0,
    positionCount: 0
  });

  const fetchStatus = useCallback(async () => {
    try {
      const status = gps51RealTimeActivationService.getActivationStatus();
      const health = await gps51RealTimeActivationService.getSystemHealth();
      
      setIsActive(status.isActive);
      setStats(status.stats);
      setSystemHealth(health);
    } catch (error) {
      console.error('Error fetching real-time activation status:', error);
    }
  }, []);

  const activate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gps51RealTimeActivationService.activateRealTimeSystem();
      
      if (result.success) {
        setIsActive(true);
        setStats(result.stats);
        await fetchStatus();
      }
      
      return result;
    } catch (error) {
      console.error('Error activating real-time system:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const deactivate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gps51RealTimeActivationService.deactivateRealTimeSystem();
      
      if (result.success) {
        setIsActive(false);
        await fetchStatus();
      }
      
      return result;
    } catch (error) {
      console.error('Error deactivating real-time system:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    isActive,
    loading,
    stats,
    systemHealth,
    activate,
    deactivate,
    refresh: fetchStatus
  };
};
