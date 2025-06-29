
import { GPS51DataService } from './GPS51DataService';
import { gps51Client } from './GPS51Client';
import { GPS51AuthService } from './GPS51AuthService';
import { supabase } from '@/integrations/supabase/client';

export interface SyncResult {
  success: boolean;
  devicesProcessed: number;
  positionsProcessed: number;
  error?: string;
  duration: number;
}

export class GPS51SyncService {
  private static authService = GPS51AuthService.getInstance();

  static async syncUserData(username: string, passwordHash: string): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('Starting GPS51 user data sync...');

      // Authenticate with GPS51
      const authResult = await this.authService.authenticate({
        username,
        password: passwordHash,
        apiUrl: 'https://api.gps51.com/openapi',
        from: 'WEB',
        type: 'USER'
      });

      if (!authResult) {
        throw new Error('GPS51 authentication failed');
      }

      // Create or update user in database
      let user = await GPS51DataService.getUserByUsername(username);
      if (!user) {
        user = await GPS51DataService.createUser({
          gps51_username: username,
          password_hash: passwordHash,
          user_type: 1
        });
      } else {
        user = await GPS51DataService.updateUser(user.id, {
          password_hash: passwordHash
        });
      }

      // Sync devices
      const devices = await gps51Client.getDeviceList();
      await GPS51DataService.syncDevicesFromGPS51(devices, user.id);

      // Sync positions
      let totalPositions = 0;
      if (devices.length > 0) {
        const deviceIds = devices.map(d => d.deviceid);
        const positions = await gps51Client.getRealtimePositions(deviceIds);
        await GPS51DataService.syncPositionsFromGPS51(positions);
        totalPositions = positions.length;
      }

      const duration = Date.now() - startTime;
      
      console.log(`GPS51 sync completed: ${devices.length} devices, ${totalPositions} positions in ${duration}ms`);
      
      return {
        success: true,
        devicesProcessed: devices.length,
        positionsProcessed: totalPositions,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('GPS51 sync failed:', error);
      
      return {
        success: false,
        devicesProcessed: 0,
        positionsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  static async syncPositionsOnly(): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('Starting GPS51 positions-only sync...');

      // Check if we have authenticated client
      if (!this.authService.isAuthenticated()) {
        throw new Error('GPS51 not authenticated');
      }

      // Get all devices from database
      const { data: devices, error } = await supabase
        .from('devices')
        .select('device_id');

      if (error) throw error;
      if (!devices || devices.length === 0) {
        throw new Error('No devices found in database');
      }

      // Get positions from GPS51
      const deviceIds = devices.map(d => d.device_id);
      const positions = await gps51Client.getRealtimePositions(deviceIds);
      
      // Sync positions to database
      await GPS51DataService.syncPositionsFromGPS51(positions);

      const duration = Date.now() - startTime;
      
      console.log(`GPS51 positions sync completed: ${positions.length} positions in ${duration}ms`);
      
      return {
        success: true,
        devicesProcessed: devices.length,
        positionsProcessed: positions.length,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('GPS51 positions sync failed:', error);
      
      return {
        success: false,
        devicesProcessed: 0,
        positionsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration
      };
    }
  }

  static async getStoredCredentials(): Promise<{ username: string; passwordHash: string } | null> {
    try {
      const username = localStorage.getItem('gps51_username');
      const passwordHash = localStorage.getItem('gps51_password_hash');
      
      if (username && passwordHash) {
        return { username, passwordHash };
      }
      return null;
    } catch (error) {
      console.error('Failed to get stored credentials:', error);
      return null;
    }
  }

  static async performScheduledSync(): Promise<SyncResult> {
    const credentials = await this.getStoredCredentials();
    
    if (!credentials) {
      return {
        success: false,
        devicesProcessed: 0,
        positionsProcessed: 0,
        error: 'No stored credentials found',
        duration: 0
      };
    }

    // Try positions-only sync first (faster)
    if (this.authService.isAuthenticated()) {
      return await this.syncPositionsOnly();
    }

    // Fall back to full sync with authentication
    return await this.syncUserData(credentials.username, credentials.passwordHash);
  }
}
