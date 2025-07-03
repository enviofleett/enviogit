import { GPS51Device, GPS51Group } from '../GPS51Types';
import { GPS51DirectAuthService } from './GPS51DirectAuthService';
import { GPS51EnhancedApiClient } from './GPS51EnhancedApiClient';
import { GPS51_STATUS } from '../GPS51Constants';

export interface VehicleServiceOptions {
  cacheTimeout?: number;
  enableCaching?: boolean;
  maxCacheSize?: number;
}

export interface VehicleQueryResult {
  devices: GPS51Device[];
  groups: GPS51Group[];
  totalCount: number;
  lastUpdated: number;
  fromCache: boolean;
}

export interface VehicleStats {
  total: number;
  online: number;
  offline: number;
  recentlyActive: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

interface CacheEntry {
  data: VehicleQueryResult;
  timestamp: number;
  expiresAt: number;
}

export class GPS51DirectVehicleService {
  private authService: GPS51DirectAuthService;
  private apiClient: GPS51EnhancedApiClient;
  private cache = new Map<string, CacheEntry>();
  private options: Required<VehicleServiceOptions>;

  constructor(
    authService: GPS51DirectAuthService,
    options: VehicleServiceOptions = {}
  ) {
    this.authService = authService;
    this.apiClient = new GPS51EnhancedApiClient();
    this.options = {
      cacheTimeout: 60000, // 1 minute
      enableCaching: true,
      maxCacheSize: 10,
      ...options
    };
  }

  async getVehicleList(forceRefresh = false): Promise<VehicleQueryResult> {
    const cacheKey = 'vehicle_list';
    
    // Check cache first
    if (!forceRefresh && this.options.enableCaching) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('GPS51DirectVehicleService: Returning cached vehicle list');
        return cached;
      }
    }

    // Ensure we're authenticated
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const user = this.authService.getUser();
    const token = this.authService.getToken();

    if (!user || !token) {
      throw new Error('No valid authentication state');
    }

    try {
      console.log('GPS51DirectVehicleService: Fetching vehicle list from API...');
      
      const response = await this.apiClient.makeAuthenticatedRequest(
        'querymonitorlist',
        { username: user.username },
        'POST',
        token,
        { priority: 'high' }
      );

      if (response.status !== GPS51_STATUS.SUCCESS) {
        throw new Error(
          response.cause || response.message || `API returned status: ${response.status}`
        );
      }

      const result = this.processVehicleResponse(response);
      
      // Cache the result
      if (this.options.enableCaching) {
        this.addToCache(cacheKey, result);
      }

      console.log('GPS51DirectVehicleService: Vehicle list fetched successfully:', {
        totalDevices: result.totalCount,
        groupCount: result.groups.length
      });

      return result;

    } catch (error) {
      console.error('GPS51DirectVehicleService: Failed to fetch vehicle list:', error);
      throw error;
    }
  }

  private processVehicleResponse(response: any): VehicleQueryResult {
    const now = Date.now();
    let devices: GPS51Device[] = [];
    let groups: GPS51Group[] = [];

    // Process groups and extract devices
    if (response.groups && Array.isArray(response.groups)) {
      groups = response.groups;
      
      groups.forEach(group => {
        if (group.devices && Array.isArray(group.devices)) {
          // Validate and enhance device data
          const validatedDevices = group.devices.map(device => this.validateDevice(device));
          devices = devices.concat(validatedDevices);
        }
      });
    } else if (response.data || response.devices) {
      // Fallback: direct device array
      const deviceArray = response.data || response.devices || [];
      if (Array.isArray(deviceArray)) {
        devices = deviceArray.map(device => this.validateDevice(device));
      }
    }

    return {
      devices,
      groups,
      totalCount: devices.length,
      lastUpdated: now,
      fromCache: false
    };
  }

  private validateDevice(device: any): GPS51Device {
    // Ensure required fields exist
    const validated: GPS51Device = {
      deviceid: device.deviceid || '',
      devicename: device.devicename || 'Unknown Device',
      devicetype: device.devicetype || 'Unknown',
      simnum: device.simnum || '',
      lastactivetime: device.lastactivetime || 0,
      isfree: device.isfree || 0,
      allowedit: device.allowedit || 0,
      icon: device.icon || 0,
      ...device // Keep all other fields
    };

    // Validate coordinates if present
    if (validated.callat !== undefined) {
      validated.callat = this.validateCoordinate(validated.callat, -90, 90);
    }
    if (validated.callon !== undefined) {
      validated.callon = this.validateCoordinate(validated.callon, -180, 180);
    }

    return validated;
  }

  private validateCoordinate(value: any, min: number, max: number): number {
    const num = Number(value);
    if (isNaN(num) || num < min || num > max) {
      return 0; // Invalid coordinate
    }
    return num;
  }

  async getVehicleById(deviceId: string): Promise<GPS51Device | null> {
    const vehicleList = await this.getVehicleList();
    return vehicleList.devices.find(device => device.deviceid === deviceId) || null;
  }

  async searchVehicles(query: string): Promise<GPS51Device[]> {
    const vehicleList = await this.getVehicleList();
    const lowercaseQuery = query.toLowerCase();

    return vehicleList.devices.filter(device =>
      device.devicename.toLowerCase().includes(lowercaseQuery) ||
      device.deviceid.toLowerCase().includes(lowercaseQuery) ||
      device.devicetype.toLowerCase().includes(lowercaseQuery) ||
      (device.simnum && device.simnum.toLowerCase().includes(lowercaseQuery))
    );
  }

  getVehicleStats(devices?: GPS51Device[]): VehicleStats {
    const vehicleList = devices || [];
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    const fourHoursAgo = now - (4 * 60 * 60 * 1000);

    const stats: VehicleStats = {
      total: vehicleList.length,
      online: 0,
      offline: 0,
      recentlyActive: 0,
      byType: {},
      byStatus: {}
    };

    vehicleList.forEach(device => {
      // Activity analysis
      const lastActiveTime = device.lastactivetime || 0;
      const isOnline = lastActiveTime > fourHoursAgo;
      const isRecentlyActive = lastActiveTime > thirtyMinutesAgo;

      if (isOnline) {
        stats.online++;
      } else {
        stats.offline++;
      }

      if (isRecentlyActive) {
        stats.recentlyActive++;
      }

      // Type statistics
      const type = device.devicetype || 'Unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Status statistics
      const status = device.strstatus || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;
  }

  // Cache management
  private getFromCache(key: string): VehicleQueryResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      ...entry.data,
      fromCache: true
    };
  }

  private addToCache(key: string, data: VehicleQueryResult): void {
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanupCache();

    // Add new entry
    this.cache.set(key, {
      data: { ...data, fromCache: false },
      timestamp: now,
      expiresAt: now + this.options.cacheTimeout
    });

    // Enforce cache size limit
    if (this.cache.size > this.options.maxCacheSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log('GPS51DirectVehicleService: Cache cleared');
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; expiresIn: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      expiresIn: Math.max(0, entry.expiresAt - now)
    }));

    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      hitRate: 0, // TODO: Implement hit rate tracking
      entries
    };
  }
}