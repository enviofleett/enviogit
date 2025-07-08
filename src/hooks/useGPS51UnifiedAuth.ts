import { useState, useEffect, useCallback } from 'react';
import { gps51UnifiedService } from '@/services/gps51/unified/GPS51UnifiedService';
import { GPS51ConfigStorage } from '@/services/gps51/configStorage';
import { useToast } from './use-toast';

export interface GPS51Credentials {
  username: string;
  password: string;
  apiUrl: string;
}

export interface GPS51AuthStatus {
  isAuthenticated: boolean;
  isConfigured: boolean;
  username: string | null;
  error: string | null;
  deviceCount: number;
  movingVehicles: number;
}

export function useGPS51UnifiedAuth() {
  const [status, setStatus] = useState<GPS51AuthStatus>({
    isAuthenticated: false,
    isConfigured: false,
    username: null,
    error: null,
    deviceCount: 0,
    movingVehicles: 0
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateStatus = useCallback(() => {
    const isConfigured = GPS51ConfigStorage.isConfigured();
    const authState = gps51UnifiedService.getAuthState();
    const serviceStatus = gps51UnifiedService.getServiceStatus();

    setStatus({
      isAuthenticated: authState.isAuthenticated,
      isConfigured,
      username: authState.username,
      error: authState.error || null,
      deviceCount: serviceStatus.deviceCount,
      movingVehicles: serviceStatus.movingVehicles
    });
  }, []);

  const authenticate = useCallback(async (credentials?: GPS51Credentials) => {
    setLoading(true);
    try {
      let authResult;
      
      if (credentials) {
        // Save credentials first
        GPS51ConfigStorage.saveConfiguration({
          apiUrl: credentials.apiUrl,
          username: credentials.username,
          password: credentials.password,
          from: 'WEB',
          type: 'USER'
        });
        
        authResult = await gps51UnifiedService.authenticate(
          credentials.username,
          credentials.password
        );
      } else {
        // Use stored credentials
        const config = GPS51ConfigStorage.getConfiguration();
        if (config) {
          authResult = await gps51UnifiedService.authenticate(config.username, config.password);
        } else {
          throw new Error('No stored credentials found');
        }
      }

      if (authResult.isAuthenticated) {
        toast({
          title: "Authentication Successful",
          description: `Connected as ${authResult.username || 'user'}`,
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: authResult.error || 'Please check your credentials',
          variant: "destructive",
        });
      }

      updateStatus();
      return authResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
      updateStatus();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [updateStatus, toast]);

  const logout = useCallback(async () => {
    try {
      await gps51UnifiedService.logout();
      toast({
        title: "Logged Out",
        description: "Successfully logged out of GPS51",
      });
      updateStatus();
    } catch (error) {
      console.error('Logout error:', error);
      updateStatus();
    }
  }, [updateStatus, toast]);

  const fetchDevices = useCallback(async () => {
    if (!status.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const devices = await gps51UnifiedService.fetchUserDevices();
      updateStatus();
      return devices;
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      throw error;
    }
  }, [status.isAuthenticated, updateStatus]);

  const fetchLiveData = useCallback(async (deviceIds?: string[]) => {
    if (!status.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      const result = await gps51UnifiedService.fetchLivePositions(deviceIds);
      updateStatus();
      return result;
    } catch (error) {
      console.error('Failed to fetch live data:', error);
      throw error;
    }
  }, [status.isAuthenticated, updateStatus]);

  // Initialize status on mount and set up auto-refresh
  useEffect(() => {
    updateStatus();
    
    // Auto-authenticate if configured but not authenticated
    const isConfigured = GPS51ConfigStorage.isConfigured();
    const authState = gps51UnifiedService.getAuthState();
    
    if (isConfigured && !authState.isAuthenticated) {
      console.log('useGPS51UnifiedAuth: Auto-authenticating with stored credentials...');
      authenticate().catch(error => {
        console.warn('Auto-authentication failed:', error);
      });
    }
    
    // Set up periodic status updates
    const interval = setInterval(updateStatus, 30000);
    return () => clearInterval(interval);
  }, [authenticate, updateStatus]);

  return {
    status,
    loading,
    authenticate,
    logout,
    fetchDevices,
    fetchLiveData,
    refresh: updateStatus
  };
}