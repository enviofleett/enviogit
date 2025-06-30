
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
        
        // Get initialization status
        const initStatus = gps51StartupService.getInitializationStatus();
        
        setStatus(prev => ({
          ...prev,
          isConnected: !!token,
          isAuthenticated,
          isConfigured,
          error: null,
          connectionHealth: token ? 'good' : (isConfigured ? 'poor' : 'lost'),
          syncStatus: initStatus.liveDataActive ? 'success' : 'idle'
        }));
      } catch (error) {
        console.error('GPS51 status check failed:', error);
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          isConnected: false,
          isAuthenticated: false,
          connectionHealth: 'lost',
          syncStatus: 'error'
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
        connectionHealth: 'good',
        isConnected: true
      }));
    };

    // Listen for token refresh events
    const handleTokenRefresh = () => {
      console.log('Token refresh event received, checking status...');
      setTimeout(checkStatus, 1000); // Small delay to allow token refresh to complete
    };

    // Listen for authentication events
    const handleAuthenticationEvent = () => {
      console.log('Authentication event received, checking status...');
      setTimeout(checkStatus, 500);
    };

    // Set up event listeners
    window.addEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
    window.addEventListener('gps51-token-refresh-needed', handleTokenRefresh);
    window.addEventListener('gps51-authentication-changed', handleAuthenticationEvent);

    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
      window.removeEventListener('gps51-token-refresh-needed', handleTokenRefresh);
      window.removeEventListener('gps51-authentication-changed', handleAuthenticationEvent);
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
          error: null,
          isAuthenticated: true,
          isConnected: true
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

  const forceRestart = async () => {
    try {
      setStatus(prev => ({ ...prev, syncStatus: 'syncing' }));
      
      const restarted = await gps51StartupService.restart();
      if (restarted) {
        setStatus(prev => ({
          ...prev,
          lastSync: new Date(),
          syncStatus: 'success',
          connectionHealth: 'good',
          error: null,
          isAuthenticated: true,
          isConnected: true
        }));
      } else {
        throw new Error('System restart failed');
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Restart failed',
        syncStatus: 'error',
        connectionHealth: 'poor'
      }));
    }
  };

  return { 
    status, 
    updateStatus, 
    forceRefresh, 
    forceRestart,
    initializationStatus: gps51StartupService.getInitializationStatus()
  };
};
