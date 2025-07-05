import { GPS51Device, GPS51Position } from './types';

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

// Stub implementation until database schema is ready
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
   * Store enhanced sync data to database - STUB IMPLEMENTATION
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
    console.log('GPS51DatabaseService: Enhanced sync temporarily disabled - database schema pending');
    console.log(`GPS51DatabaseService: Would store ${devices.length} devices and ${positions.length} positions`);

    return {
      vehiclesUpserted: devices.length,
      positionsStored: positions.length,
      syncJobId: `stub-${Date.now()}`,
      executionTimeMs: 100,
      errors: []
    };
  }

  /**
   * Get sync job history - STUB IMPLEMENTATION
   */
  async getSyncJobHistory(limit: number = 50, offset: number = 0) {
    console.log('GPS51DatabaseService: Sync job history temporarily disabled - database schema pending');
    return [];
  }

  /**
   * Get latest vehicle positions - STUB IMPLEMENTATION
   */
  async getLatestVehiclePositions(vehicleIds?: string[]) {
    console.log('GPS51DatabaseService: Vehicle positions temporarily disabled - database schema pending');
    return [];
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
    return {
      totalEntries: this.cache.size,
      validEntries: 0,
      expiredEntries: 0,
      hitRatio: 0
    };
  }
}

export const gps51DatabaseService = GPS51DatabaseService.getInstance();