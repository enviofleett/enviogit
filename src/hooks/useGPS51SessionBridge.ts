
import { GPS51ConnectionService } from '@/services/gp51/GPS51ConnectionService';
import { useGPS51SessionStatus } from './useGPS51SessionStatus';
import { SessionStatus, GPS51ConnectionCredentials } from './types/sessionBridgeTypes';

export { type SessionStatus } from './types/sessionBridgeTypes';

export const useGPS51SessionBridge = () => {
  const { status, updateStatus } = useGPS51SessionStatus();
  const connectionService = new GPS51ConnectionService();

  const connect = async (credentials: GPS51ConnectionCredentials) => {
    try {
      updateStatus({ error: null, syncStatus: 'syncing' });
      
      const result = await connectionService.connect(credentials);
      
      if (result.success) {
        updateStatus({ 
          isAuthenticated: true, 
          isConnected: true,
          isConfigured: true,
          lastSync: new Date(),
          syncStatus: 'success',
          connectionHealth: 'good',
          error: null
        });
        return true;
      } else {
        updateStatus({
          error: result.error || 'Connection failed',
          isConnected: false,
          isAuthenticated: false,
          syncStatus: 'error',
          connectionHealth: 'lost'
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      updateStatus({
        error: errorMessage,
        isConnected: false,
        isAuthenticated: false,
        syncStatus: 'error',
        connectionHealth: 'lost'
      });
      return false;
    }
  };

  const disconnect = () => {
    connectionService.disconnect();
    updateStatus({
      isConnected: false,
      isAuthenticated: false,
      isConfigured: false,
      lastSync: null,
      error: null,
      syncStatus: 'idle',
      connectionHealth: 'lost'
    });
  };

  const refresh = async () => {
    try {
      updateStatus({ syncStatus: 'syncing', error: null });
      
      const result = await connectionService.refresh();
      
      updateStatus({
        lastSync: new Date(),
        error: null,
        syncStatus: 'success',
        connectionHealth: 'good'
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      updateStatus({
        error: errorMessage,
        syncStatus: 'error',
        connectionHealth: 'poor'
      });
      throw error;
    }
  };

  return {
    status,
    connect,
    disconnect,
    refresh
  };
};
