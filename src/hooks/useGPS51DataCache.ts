import { useState, useCallback, useRef } from 'react';
import type { GPS51Device, GPS51Position } from '../services/gps51/direct';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number;
  compressed?: boolean;
}

export interface CacheConfig {
  defaultTTL: number;        // Default time-to-live in ms
  maxSize: number;           // Maximum cache entries
  compressionThreshold: number; // Compress data larger than this (bytes)
  enableCompression: boolean;
  persistToStorage: boolean;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number; // Estimated bytes
  oldestEntry: number;
  newestEntry: number;
}

export interface UseGPS51DataCacheReturn {
  // Core cache operations
  set: <T>(key: string, data: T, ttl?: number) => void;
  get: <T>(key: string) => T | null;
  has: (key: string) => boolean;
  delete: (key: string) => boolean;
  clear: () => void;
  
  // Specialized GPS51 operations
  cacheVehicles: (vehicles: GPS51Device[], ttl?: number) => void;
  getCachedVehicles: () => GPS51Device[] | null;
  cachePositions: (positions: GPS51Position[], deviceId?: string, ttl?: number) => void;
  getCachedPositions: (deviceId?: string) => GPS51Position[] | null;
  
  // Cache management
  cleanup: () => number; // Returns number of expired entries removed
  getStats: () => CacheStats;
  optimize: () => void;
  export: () => string;
  import: (data: string) => boolean;
  
  // Configuration
  updateConfig: (config: Partial<CacheConfig>) => void;
  getConfig: () => CacheConfig;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 300000,        // 5 minutes
  maxSize: 1000,             // 1000 entries
  compressionThreshold: 10240, // 10KB
  enableCompression: false,   // Disabled for simplicity
  persistToStorage: true
};

export function useGPS51DataCache(
  initialConfig: Partial<CacheConfig> = {}
): UseGPS51DataCacheReturn {
  const [config, setConfig] = useState<CacheConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig
  });

  const cache = useRef(new Map<string, CacheEntry<any>>());
  const stats = useRef({
    hits: 0,
    misses: 0,
    lastCleanup: Date.now()
  });

  // Load from localStorage on init
  if (config.persistToStorage && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('gps51-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        cache.current = new Map(Object.entries(parsed));
        console.log('GPS51 Data Cache: Loaded from storage:', cache.current.size, 'entries');
      }
    } catch (error) {
      console.warn('GPS51 Data Cache: Failed to load from storage:', error);
    }
  }

  // Persist to localStorage
  const persistCache = useCallback(() => {
    if (!config.persistToStorage || typeof window === 'undefined') return;

    try {
      const cacheObject = Object.fromEntries(cache.current);
      localStorage.setItem('gps51-cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('GPS51 Data Cache: Failed to persist to storage:', error);
    }
  }, [config.persistToStorage]);

  // Estimate memory usage
  const estimateSize = useCallback((data: any): number => {
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
  }, []);

  // Compress data (simplified - in real implementation would use actual compression)
  const compressData = useCallback((data: any): any => {
    if (!config.enableCompression) return data;
    
    // For now, just return as-is. In production, use a compression library
    return data;
  }, [config.enableCompression]);

  // Decompress data
  const decompressData = useCallback((data: any, compressed: boolean): any => {
    if (!compressed || !config.enableCompression) return data;
    
    // For now, just return as-is
    return data;
  }, [config.enableCompression]);

  // Clean up expired entries
  const cleanup = useCallback((): number => {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of cache.current) {
      if (now > entry.expiresAt) {
        cache.current.delete(key);
        removedCount++;
      }
    }

    stats.current.lastCleanup = now;

    if (removedCount > 0) {
      console.log('GPS51 Data Cache: Cleaned up', removedCount, 'expired entries');
      persistCache();
    }

    return removedCount;
  }, [persistCache]);

  // Enforce cache size limit
  const enforceSizeLimit = useCallback(() => {
    if (cache.current.size <= config.maxSize) return;

    // Remove oldest entries first
    const entries = Array.from(cache.current.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = cache.current.size - config.maxSize;
    for (let i = 0; i < toRemove; i++) {
      cache.current.delete(entries[i][0]);
    }

    console.log('GPS51 Data Cache: Enforced size limit, removed', toRemove, 'entries');
  }, [config.maxSize]);

  // Set cache entry
  const set = useCallback(<T>(key: string, data: T, ttl = config.defaultTTL): void => {
    cleanup(); // Clean up first

    const now = Date.now();
    const dataSize = estimateSize(data);
    const shouldCompress = config.enableCompression && dataSize > config.compressionThreshold;
    
    const entry: CacheEntry<T> = {
      data: shouldCompress ? compressData(data) : data,
      timestamp: now,
      expiresAt: now + ttl,
      version: 1,
      compressed: shouldCompress
    };

    cache.current.set(key, entry);
    enforceSizeLimit();
    persistCache();

    console.log('GPS51 Data Cache: Set', key, `(${Math.round(dataSize / 1024)}KB, TTL: ${ttl}ms)`);
  }, [config.defaultTTL, config.enableCompression, config.compressionThreshold, cleanup, estimateSize, compressData, enforceSizeLimit, persistCache]);

  // Get cache entry
  const get = useCallback(<T>(key: string): T | null => {
    const entry = cache.current.get(key);
    
    if (!entry) {
      stats.current.misses++;
      return null;
    }

    const now = Date.now();
    
    if (now > entry.expiresAt) {
      cache.current.delete(key);
      stats.current.misses++;
      return null;
    }

    stats.current.hits++;
    return decompressData(entry.data, entry.compressed || false);
  }, [decompressData]);

  // Check if key exists and is valid
  const has = useCallback((key: string): boolean => {
    const entry = cache.current.get(key);
    
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      cache.current.delete(key);
      return false;
    }
    
    return true;
  }, []);

  // Delete cache entry
  const deleteEntry = useCallback((key: string): boolean => {
    const deleted = cache.current.delete(key);
    if (deleted) persistCache();
    return deleted;
  }, [persistCache]);

  // Clear all cache
  const clear = useCallback(() => {
    cache.current.clear();
    stats.current.hits = 0;
    stats.current.misses = 0;
    persistCache();
    console.log('GPS51 Data Cache: Cleared all entries');
  }, [persistCache]);

  // Specialized GPS51 operations
  const cacheVehicles = useCallback((vehicles: GPS51Device[], ttl = config.defaultTTL) => {
    set('vehicles:list', vehicles, ttl);
    
    // Also cache individual vehicles
    vehicles.forEach(vehicle => {
      set(`vehicle:${vehicle.deviceid}`, vehicle, ttl);
    });
  }, [set, config.defaultTTL]);

  const getCachedVehicles = useCallback((): GPS51Device[] | null => {
    return get<GPS51Device[]>('vehicles:list');
  }, [get]);

  const cachePositions = useCallback((positions: GPS51Position[], deviceId = 'all', ttl = config.defaultTTL / 2) => {
    const key = `positions:${deviceId}`;
    set(key, positions, ttl);
    
    // Cache latest position for each device
    positions.forEach(position => {
      set(`position:latest:${position.deviceid}`, position, ttl);
    });
  }, [set, config.defaultTTL]);

  const getCachedPositions = useCallback((deviceId = 'all'): GPS51Position[] | null => {
    const key = `positions:${deviceId}`;
    return get<GPS51Position[]>(key);
  }, [get]);

  // Get cache statistics
  const getStats = useCallback((): CacheStats => {
    const entries = Array.from(cache.current.values());
    const totalRequests = stats.current.hits + stats.current.misses;
    
    let memoryUsage = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    entries.forEach(entry => {
      memoryUsage += estimateSize(entry.data);
      oldestEntry = Math.min(oldestEntry, entry.timestamp);
      newestEntry = Math.max(newestEntry, entry.timestamp);
    });

    return {
      totalEntries: cache.current.size,
      hitRate: totalRequests > 0 ? (stats.current.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (stats.current.misses / totalRequests) * 100 : 0,
      totalHits: stats.current.hits,
      totalMisses: stats.current.misses,
      memoryUsage,
      oldestEntry: entries.length > 0 ? oldestEntry : 0,
      newestEntry: entries.length > 0 ? newestEntry : 0
    };
  }, [estimateSize]);

  // Optimize cache (cleanup + defrag)
  const optimize = useCallback(() => {
    const removed = cleanup();
    enforceSizeLimit();
    persistCache();
    
    console.log('GPS51 Data Cache: Optimization complete, removed', removed, 'expired entries');
  }, [cleanup, enforceSizeLimit, persistCache]);

  // Export cache data
  const exportCache = useCallback((): string => {
    const cacheObject = Object.fromEntries(cache.current);
    return JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      config,
      data: cacheObject
    });
  }, [config]);

  // Import cache data
  const importCache = useCallback((data: string): boolean => {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.version && parsed.data) {
        cache.current = new Map(Object.entries(parsed.data));
        console.log('GPS51 Data Cache: Imported', cache.current.size, 'entries');
        persistCache();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('GPS51 Data Cache: Import failed:', error);
      return false;
    }
  }, [persistCache]);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<CacheConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    console.log('GPS51 Data Cache: Config updated', newConfig);
  }, []);

  const getConfig = useCallback(() => ({ ...config }), [config]);

  return {
    set,
    get,
    has,
    delete: deleteEntry,
    clear,
    cacheVehicles,
    getCachedVehicles,
    cachePositions,
    getCachedPositions,
    cleanup,
    getStats,
    optimize,
    export: exportCache,
    import: importCache,
    updateConfig,
    getConfig
  };
}