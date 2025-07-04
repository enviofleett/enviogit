import { supabase } from '@/integrations/supabase/client';
import { GPS51Device, GPS51Position } from './types';
import { EnhancedLiveDataState } from './GPS51EnhancedStateManager';

export interface DatabaseSyncResult {
  success: boolean;
  vehiclesProcessed: number;
  positionsStored: number;
  syncJobId?: string;
  executionTime: number;
  error?: string;
}

export class GPS51DatabaseIntegration {
  private static instance: GPS51DatabaseIntegration;

  static getInstance(): GPS51DatabaseIntegration {
    if (!GPS51DatabaseIntegration.instance) {
      GPS51DatabaseIntegration.instance = new GPS51DatabaseIntegration();
    }
    return GPS51DatabaseIntegration.instance;
  }

  /**
   * Sync GPS51 data to Supabase database
   */
  async syncToDatabase(data: EnhancedLiveDataState): Promise<DatabaseSyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51DatabaseIntegration: Starting database sync...', {
        devices: data.devices.length,
        positions: data.positions.length,
        lastUpdate: data.lastUpdate
      });

      // Start a sync job record
      const syncJobId = await this.createSyncJob(data.devices.length);

      let vehiclesProcessed = 0;
      let positionsStored = 0;

      // Process vehicles
      if (data.devices.length > 0) {
        vehiclesProcessed = await this.syncVehicles(data.devices);
      }

      // Process positions
      if (data.positions.length > 0) {
        positionsStored = await this.syncPositions(data.positions);
      }

      const executionTime = Date.now() - startTime;

      // Complete the sync job
      if (syncJobId) {
        await this.completeSyncJob(syncJobId, true, vehiclesProcessed, positionsStored, executionTime);
      }

      console.log('GPS51DatabaseIntegration: Database sync completed successfully', {
        vehiclesProcessed,
        positionsStored,
        executionTime: `${executionTime}ms`,
        syncJobId
      });

      return {
        success: true,
        vehiclesProcessed,
        positionsStored,
        syncJobId,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error('GPS51DatabaseIntegration: Database sync failed:', error);

      return {
        success: false,
        vehiclesProcessed: 0,
        positionsStored: 0,
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync vehicle data to database
   */
  private async syncVehicles(devices: GPS51Device[]): Promise<number> {
    try {
      console.log(`GPS51DatabaseIntegration: Syncing ${devices.length} vehicles to database...`);

      const vehicleData = devices.map(device => ({
        license_plate: device.devicename || device.deviceid,
        brand: 'GPS51',
        model: device.devicetype || 'Unknown',
        type: 'van' as const, // Using 'van' as it's a valid enum value
        status: 'available' as const,
        gps51_device_id: device.deviceid,
        notes: `Last active: ${device.lastactivetime ? new Date(device.lastactivetime).toISOString() : 'Unknown'}`
      }));

      // Upsert vehicles with proper conflict resolution
      const { data, error } = await supabase
        .from('vehicles')
        .upsert(vehicleData, {
          onConflict: 'license_plate',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('GPS51DatabaseIntegration: Vehicle sync error:', error);
        throw error;
      }

      console.log(`GPS51DatabaseIntegration: Successfully synced ${data?.length || 0} vehicles`);
      return data?.length || 0;

    } catch (error) {
      console.error('GPS51DatabaseIntegration: Failed to sync vehicles:', error);
      throw error;
    }
  }

  /**
   * Sync position data to database
   */
  private async syncPositions(positions: GPS51Position[]): Promise<number> {
    try {
      console.log(`GPS51DatabaseIntegration: Syncing ${positions.length} positions to database...`);

      // First, get vehicle IDs from our database based on GPS51 device IDs
      const deviceIds = [...new Set(positions.map(p => p.deviceid))];
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id, gps51_device_id')
        .in('gps51_device_id', deviceIds);

      if (vehicleError) {
        console.error('GPS51DatabaseIntegration: Error fetching vehicles:', vehicleError);
        throw vehicleError;
      }

      const deviceToVehicleMap = new Map(
        vehicles?.map(v => [v.gps51_device_id, v.id]) || []
      );

      // Prepare position data for database
      const positionData = positions
        .filter(position => deviceToVehicleMap.has(position.deviceid))
        .map(position => ({
          vehicle_id: deviceToVehicleMap.get(position.deviceid),
          latitude: parseFloat(position.callat.toString()),
          longitude: parseFloat(position.callon.toString()),
          speed: position.speed || 0,
          heading: position.course || 0,
          altitude: 0, // GPS51 doesn't provide altitude
          accuracy: 0, // GPS51 doesn't provide accuracy
          timestamp: new Date(position.updatetime).toISOString(),
          ignition_status: false, // GPS51 doesn't provide reliable ignition status
          fuel_level: null, // Not provided by GPS51
          engine_temperature: null, // Not provided by GPS51
          battery_level: null, // Not provided by GPS51
          recorded_at: new Date().toISOString(),
          address: null // GPS51 address not available in current position type
        }));

      if (positionData.length === 0) {
        console.warn('GPS51DatabaseIntegration: No valid positions to sync after filtering');
        return 0;
      }

      // Insert position data
      const { data, error } = await supabase
        .from('vehicle_positions')
        .insert(positionData)
        .select();

      if (error) {
        console.error('GPS51DatabaseIntegration: Position sync error:', error);
        throw error;
      }

      console.log(`GPS51DatabaseIntegration: Successfully synced ${data?.length || 0} positions`);
      return data?.length || 0;

    } catch (error) {
      console.error('GPS51DatabaseIntegration: Failed to sync positions:', error);
      throw error;
    }
  }

  /**
   * Create a sync job record
   */
  private async createSyncJob(deviceCount: number): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('gps51_sync_jobs')
        .insert({
          priority: 1,
          started_at: new Date().toISOString(),
          vehicles_processed: 0,
          positions_stored: 0
        })
        .select()
        .single();

      if (error) {
        console.warn('GPS51DatabaseIntegration: Failed to create sync job record:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.warn('GPS51DatabaseIntegration: Error creating sync job:', error);
      return null;
    }
  }

  /**
   * Complete a sync job record
   */
  private async completeSyncJob(
    jobId: string, 
    success: boolean, 
    vehiclesProcessed: number, 
    positionsStored: number, 
    executionTime: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success,
          vehicles_processed: vehiclesProcessed,
          positions_stored: positionsStored,
          execution_time_seconds: Math.round(executionTime / 1000),
          error_message: success ? null : 'Sync completed with errors'
        })
        .eq('id', jobId);

      if (error) {
        console.warn('GPS51DatabaseIntegration: Failed to update sync job:', error);
      }
    } catch (error) {
      console.warn('GPS51DatabaseIntegration: Error updating sync job:', error);
    }
  }

  /**
   * Get recent sync job statistics
   */
  async getSyncJobStats(): Promise<{
    recentJobs: number;
    successRate: number;
    avgExecutionTime: number;
    totalVehiclesProcessed: number;
    totalPositionsStored: number;
  }> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .gte('started_at', twentyFourHoursAgo)
        .order('started_at', { ascending: false });

      if (error) {
        throw error;
      }

      const jobs = data || [];
      const successfulJobs = jobs.filter(job => job.success);
      const totalJobs = jobs.length;

      return {
        recentJobs: totalJobs,
        successRate: totalJobs > 0 ? (successfulJobs.length / totalJobs) * 100 : 0,
        avgExecutionTime: totalJobs > 0 ? 
          jobs.reduce((sum, job) => sum + (job.execution_time_seconds || 0), 0) / totalJobs : 0,
        totalVehiclesProcessed: jobs.reduce((sum, job) => sum + (job.vehicles_processed || 0), 0),
        totalPositionsStored: jobs.reduce((sum, job) => sum + (job.positions_stored || 0), 0)
      };

    } catch (error) {
      console.error('GPS51DatabaseIntegration: Failed to get sync job stats:', error);
      return {
        recentJobs: 0,
        successRate: 0,
        avgExecutionTime: 0,
        totalVehiclesProcessed: 0,
        totalPositionsStored: 0
      };
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('count', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
    }
  }
}

export const gps51DatabaseIntegration = GPS51DatabaseIntegration.getInstance();