import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { GPS51Device, GPS51Position } from './types';

type VehicleRow = Database['public']['Tables']['vehicles']['Row'];
type VehiclePositionRow = Database['public']['Tables']['vehicle_positions']['Row'];
type GPS51SyncJobRow = Database['public']['Tables']['gps51_sync_jobs']['Row'];

export interface DatabaseSyncResult {
  vehiclesUpserted: number;
  positionsStored: number;
  syncJobId: string;
  executionTimeMs: number;
  errors: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class GPS51DatabaseService {
  private static instance: GPS51DatabaseService;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly POSITION_BATCH_SIZE = 100;

  static getInstance(): GPS51DatabaseService {
    if (!GPS51DatabaseService.instance) {
      GPS51DatabaseService.instance = new GPS51DatabaseService();
    }
    return GPS51DatabaseService.instance;
  }

  /**
   * Store enhanced sync data to database with batching and caching
   */
  async storeEnhancedSyncData(
    devices: GPS51Device[],
    positions: GPS51Position[],
    metrics: {
      totalSyncTime: number;
      validationErrors: number;
      duplicatesFiltered: number;
    }
  ): Promise<DatabaseSyncResult> {
    const syncStartTime = Date.now();
    const errors: string[] = [];
    let vehiclesUpserted = 0;
    let positionsStored = 0;

    try {
      // Create sync job record
      const { data: syncJob, error: syncJobError } = await supabase
        .from('gps51_sync_jobs')
        .insert({
          job_type: 'gps51_sync',
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (syncJobError) {
        throw new Error(`Failed to create sync job: ${syncJobError.message}`);
      }

      const syncJobId = syncJob.id;

      // Upsert vehicles with caching
      if (devices.length > 0) {
        vehiclesUpserted = await this.upsertVehiclesWithCache(devices);
      }

      // Store positions in batches
      if (positions.length > 0) {
        positionsStored = await this.storePositionsInBatches(positions);
      }

      // Update sync job completion
      const executionTimeMs = Date.now() - syncStartTime;
      await supabase
        .from('gps51_sync_jobs')
        .update({
          completed_at: new Date().toISOString(),
          success: true,
          vehicles_processed: vehiclesUpserted,
          positions_stored: positionsStored,
          execution_time_seconds: Math.round(executionTimeMs / 1000)
        })
        .eq('id', syncJobId);

      console.log('GPS51DatabaseService: Enhanced sync data stored successfully', {
        syncJobId,
        vehiclesUpserted,
        positionsStored,
        executionTimeMs,
        validationErrors: metrics.validationErrors,
        duplicatesFiltered: metrics.duplicatesFiltered
      });

      return {
        vehiclesUpserted,
        positionsStored,
        syncJobId,
        executionTimeMs,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      errors.push(errorMessage);
      console.error('GPS51DatabaseService: Failed to store enhanced sync data:', error);
      
      return {
        vehiclesUpserted,
        positionsStored,
        syncJobId: '',
        executionTimeMs: Date.now() - syncStartTime,
        errors
      };
    }
  }

  /**
   * Upsert vehicles with intelligent caching
   */
  private async upsertVehiclesWithCache(devices: GPS51Device[]): Promise<number> {
    const cacheKey = 'vehicles_hash';
    const devicesHash = this.generateDataHash(devices);
    
    // Check cache to avoid unnecessary database operations
    const cachedHash = this.getFromCache<string>(cacheKey);
    if (cachedHash === devicesHash) {
      console.log('GPS51DatabaseService: Vehicles unchanged, skipping upsert');
      return 0;
    }

    const vehicleData = devices.map(device => ({
      license_plate: device.devicename,
      gps51_device_id: device.deviceid,
      brand: 'GPS51',
      model: `Device ${device.devicetype}`,
      type: this.mapDeviceTypeToVehicleType(device.devicetype) as 'sedan' | 'truck' | 'motorcycle' | 'bike' | 'van' | 'other',
      status: device.isfree === 1 ? 'available' as const : 'assigned' as const,
      notes: `GPS51 Device ID: ${device.deviceid}${device.simnum ? `, SIM: ${device.simnum}` : ''}`,
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('vehicles')
      .upsert(vehicleData, { 
        onConflict: 'license_plate',
        ignoreDuplicates: false 
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to upsert vehicles: ${error.message}`);
    }

    // Update cache
    this.setCache(cacheKey, devicesHash, this.DEFAULT_TTL);
    
    return data?.length || 0;
  }

  /**
   * Store positions in optimized batches
   */
  private async storePositionsInBatches(positions: GPS51Position[]): Promise<number> {
    let totalStored = 0;
    const batches = this.createBatches(positions, this.POSITION_BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`GPS51DatabaseService: Processing position batch ${i + 1}/${batches.length} (${batch.length} positions)`);

      try {
        const stored = await this.storeSinglePositionBatch(batch);
        totalStored += stored;
      } catch (error) {
        console.error(`GPS51DatabaseService: Failed to store batch ${i + 1}:`, error);
        // Continue with next batch rather than failing completely
      }

      // Small delay between batches to avoid overwhelming the database
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    return totalStored;
  }

  /**
   * Store a single batch of positions
   */
  private async storeSinglePositionBatch(positions: GPS51Position[]): Promise<number> {
    // First, get vehicle IDs for all devices in this batch
    const deviceIds = [...new Set(positions.map(pos => pos.deviceid))];
    
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, gps51_device_id')
      .in('gps51_device_id', deviceIds);

    if (vehicleError) {
      throw new Error(`Failed to fetch vehicle IDs: ${vehicleError.message}`);
    }

    const deviceToVehicleMap = new Map(
      vehicles?.map(v => [v.gps51_device_id, v.id]) || []
    );

    // Prepare position data
    const positionData = positions
      .filter(pos => deviceToVehicleMap.has(pos.deviceid))
      .map(pos => ({
        vehicle_id: deviceToVehicleMap.get(pos.deviceid)!,
        device_id: pos.deviceid,
        latitude: parseFloat(pos.callat.toString()),
        longitude: parseFloat(pos.callon.toString()),
        speed: pos.speed || 0,
        heading: pos.course || 0,
        altitude: pos.altitude || 0,
        timestamp: new Date(pos.updatetime).toISOString(),
        ignition_status: pos.moving === 1,
        fuel_level: pos.fuel || null,
        engine_temperature: pos.temp1 || null,
        battery_level: pos.voltage || null,
        address: pos.strstatus || null
      }));

    if (positionData.length === 0) {
      return 0;
    }

    const { error } = await supabase
      .from('vehicle_positions')
      .insert(positionData);

    if (error) {
      throw new Error(`Failed to insert positions: ${error.message}`);
    }

    return positionData.length;
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Map GPS51 device type to vehicle type
   */
  private mapDeviceTypeToVehicleType(deviceType: number | string): 'sedan' | 'truck' | 'motorcycle' | 'bike' | 'van' | 'other' {
    // Default mapping - can be enhanced based on GPS51 device type definitions
    const type = typeof deviceType === 'string' ? parseInt(deviceType) : deviceType;
    switch (type) {
      case 1: return 'sedan';
      case 2: return 'truck';
      case 3: return 'motorcycle';
      case 4: return 'van';
      case 5: return 'bike';
      default: return 'other';
    }
  }

  /**
   * Generate hash for data comparison
   */
  private generateDataHash(data: any): string {
    return btoa(JSON.stringify(data)).substring(0, 32);
  }

  /**
   * Cache management with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Clear expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get sync job history with pagination
   */
  async getSyncJobHistory(limit: number = 50, offset: number = 0) {
    const { data, error } = await supabase
      .from('gps51_sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch sync job history: ${error.message}`);
    }

    return data;
  }

  /**
   * Get latest vehicle positions with caching
   */
  async getLatestVehiclePositions(vehicleIds?: string[]) {
    const cacheKey = `latest_positions_${vehicleIds?.join(',') || 'all'}`;
    const cached = this.getFromCache<VehiclePositionRow[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    let query = supabase
      .from('vehicle_positions')
      .select(`
        *,
        vehicles!inner(
          id,
          license_plate,
          gps51_device_id,
          type,
          status
        )
      `)
      .order('timestamp', { ascending: false });

    if (vehicleIds && vehicleIds.length > 0) {
      query = query.in('vehicle_id', vehicleIds);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      throw new Error(`Failed to fetch vehicle positions: ${error.message}`);
    }

    // Cache the results
    this.setCache(cacheKey, data || [], 60000); // 1 minute cache
    
    return data || [];
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('GPS51DatabaseService: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRatio: validEntries / (validEntries + expiredEntries || 1)
    };
  }
}

export const gps51DatabaseService = GPS51DatabaseService.getInstance();