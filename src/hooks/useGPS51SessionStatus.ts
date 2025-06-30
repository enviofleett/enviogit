
import { useState, useEffect } from 'react';
import { gps51ConfigService } from '@/services/gp51/GPS51ConfigService';
import { GPS51AuthService } from '@/services/gp51/GPS51AuthService';
import { gps51StartupService } from '@/services/gps51/GPS51StartupService';
import { SessionStatus } from './types/sessionBridgeTypes';

export const useGPS51SessionStatus = () => {
  const [status, setStatus] = useState<SessionStatus>({
    isConnected: false,
    isAuthenticated: false,
    lastSync: null,
    error: null,
    isConfigured: false,
    syncStatus: 'idle',
    connectionHealth: 'lost'
  });

  const authService = GPS51AuthService.getInstance();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isConfigured = gps51ConfigService.isConfigured();
        const isAuthenticated = isConfigured && authService.isAuthenticated();
        const token = isAuthenticated ? await authService.getValidToken() : null;
        
        setStatus(prev => ({
          ...prev,
          isConnected: !!token,
          isAuthenticated,
          isConfigured,
          error: null,
          connectionHealth: token ? 'good' : 'lost'
        }));
      } catch (error) {
        console.error('GPS51 status check failed:', error);
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isConnected: false,
          isAuthenticated: false,
          connectionHealth: 'lost'
        }));
      }
    };

    // Initial status check
    checkStatus();

    // Listen for live data updates to update sync status
    const handleLiveDataUpdate = (event: CustomEvent) => {
      setStatus(prev => ({
        ...prev,
        lastSync: new Date(),
        syncStatus: 'success',
        connectionHealth: 'good'
      }));
    };

    // Listen for token refresh events
    const handleTokenRefresh = () => {
      checkStatus();
    };

    // Set up event listeners
    window.addEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
    window.addEventListener('gps51-token-refresh-needed', handleTokenRefresh);

    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
      window.removeEventListener('gps51-token-refresh-needed', handleTokenRefresh);
    };
  }, [authService]);

  const updateStatus = (updates: Partial<SessionStatus>) => {
    setStatus(prev => ({ ...prev, ...updates }));
  };

  const forceRefresh = async () => {
    try {
      setStatus(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const refreshed = await gps51StartupService.refreshAuthentication();
      if (refreshed) {
        setStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          syncStatus: 'success',
          connectionHealth: 'good',
          error: null
        }));
      } else {
        throw new Error('Authentication refresh failed');
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Refresh failed',
        syncStatus: 'error',
        connectionHealth: 'poor'
      }));
    }
  };

  return { status, updateStatus, forceRefresh };
};
