// GPS51 Cache Optimizer - Phase 4.1
// Advanced caching strategies for optimal performance

import { gps51PerformanceMonitor } from './GPS51PerformanceMonitor';
import { gps51EventBus } from '../gps51/realtime';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  size: number;
}

export interface CacheStrategy {
  maxSize: number;
  defaultTTL: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'priority';
  compressionEnabled: boolean;
  persistentStorage: boolean;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  avgAccessTime: number;
  topKeys: string[];
}

export class GPS51CacheOptimizer {
  private cache = new Map<string, CacheEntry>();
  private accessLog: { key: string; timestamp: Date; hit: boolean }[] = [];
  private evictionCount = 0;
  private compressionWorker: Worker | null = null;

  private strategies: Record<string, CacheStrategy> = {
    vehicles: {
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'lru',
      compressionEnabled: true,
      persistentStorage: true
    },
    positions: {
      maxSize: 5000,
      defaultTTL: 60000, // 1 minute
      evictionPolicy: 'ttl',
      compressionEnabled: false,
      persistentStorage: false
    },
    analytics: {
      maxSize: 500,
      defaultTTL: 900000, // 15 minutes
      evictionPolicy: 'priority',
      compressionEnabled: true,
      persistentStorage: true
    },
    metadata: {
      maxSize: 200,
      defaultTTL: 3600000, // 1 hour
      evictionPolicy: 'lfu',
      compressionEnabled: false,
      persistentStorage: true
    }
  };

  constructor() {
    this.setupCompressionWorker();
    this.setupEventListeners();
    this.loadPersistentCache();
    this.startCleanupInterval();
  }

  // Cache Operations
  async set<T>(
    key: string,
    data: T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      tags?: string[];
      strategy?: string;
    }
  ): Promise<void> {
    const startTime = performance.now();
    const strategy = this.getStrategy(options?.strategy || this.getStrategyFromKey(key));
    
    try {
      let processedData = data;
      let size = this.estimateSize(data);

      // Compress if enabled and data is large
      if (strategy.compressionEnabled && size > 1024) {
        processedData = await this.compress(data);
        size = this.estimateSize(processedData);
      }

      const entry: CacheEntry<T> = {
        key,
        data: processedData,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + (options?.ttl || strategy.defaultTTL)),
        accessCount: 0,
        lastAccessed: new Date(),
        priority: options?.priority || 'medium',
        tags: options?.tags || [],
        size
      };

      // Check if we need to evict entries
      await this.ensureSpace(strategy, size);

      this.cache.set(key, entry);

      // Persist if strategy requires it
      if (strategy.persistentStorage) {
        await this.persistEntry(key, entry);
      }

      const duration = performance.now() - startTime;
      gps51PerformanceMonitor.trackCacheOperation('set', key, duration);

      console.log(`GPS51CacheOptimizer: Set cache entry ${key} (${size} bytes)`);

    } catch (error) {
      console.error('GPS51CacheOptimizer: Error setting cache entry:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    
    try {
      const entry = this.cache.get(key) as CacheEntry<T> | undefined;
      
      if (!entry) {
        this.logAccess(key, false);
        gps51PerformanceMonitor.trackCacheOperation('miss', key);
        return null;
      }

      // Check if expired
      if (entry.expiresAt < new Date()) {
        this.cache.delete(key);
        this.logAccess(key, false);
        gps51PerformanceMonitor.trackCacheOperation('miss', key);
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = new Date();

      let data = entry.data;

      // Decompress if needed
      const strategy = this.getStrategy(this.getStrategyFromKey(key));
      if (strategy.compressionEnabled && this.isCompressed(data)) {
        data = await this.decompress(data);
      }

      this.logAccess(key, true);
      const duration = performance.now() - startTime;
      gps51PerformanceMonitor.trackCacheOperation('hit', key, duration);

      return data;

    } catch (error) {
      console.error('GPS51CacheOptimizer: Error getting cache entry:', error);
      this.logAccess(key, false);
      return null;
    }
  }

  async invalidate(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      await this.removePersistentEntry(key);
      console.log(`GPS51CacheOptimizer: Invalidated cache entry ${key}`);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keysToInvalidate: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (entry.tags.includes(tag)) {
        keysToInvalidate.push(key);
      }
    });

    for (const key of keysToInvalidate) {
      await this.invalidate(key);
    }

    console.log(`GPS51CacheOptimizer: Invalidated ${keysToInvalidate.length} entries with tag ${tag}`);
  }

  async invalidateByPattern(pattern: RegExp): Promise<void> {
    const keysToInvalidate: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (pattern.test(key)) {
        keysToInvalidate.push(key);
      }
    });

    for (const key of keysToInvalidate) {
      await this.invalidate(key);
    }

    console.log(`GPS51CacheOptimizer: Invalidated ${keysToInvalidate.length} entries matching pattern`);
  }

  // Cache Management
  private async ensureSpace(strategy: CacheStrategy, requiredSize: number): Promise<void> {
    const currentSize = this.getTotalSize();
    const maxSize = strategy.maxSize * 1024 * 1024; // Convert to bytes

    if (currentSize + requiredSize <= maxSize) {
      return;
    }

    const targetSize = maxSize * 0.8; // Target 80% of max size
    const sizeToFree = currentSize + requiredSize - targetSize;

    await this.evictEntries(strategy.evictionPolicy, sizeToFree);
  }

  private async evictEntries(policy: string, sizeToFree: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    let freedSize = 0;
    let evictedCount = 0;

    // Sort entries based on eviction policy
    const sortedEntries = this.sortForEviction(entries, policy);

    for (const [key, entry] of sortedEntries) {
      if (freedSize >= sizeToFree) break;

      this.cache.delete(key);
      await this.removePersistentEntry(key);
      freedSize += entry.size;
      evictedCount++;

      gps51PerformanceMonitor.trackCacheOperation('evict', key);
    }

    this.evictionCount += evictedCount;
    console.log(`GPS51CacheOptimizer: Evicted ${evictedCount} entries (${freedSize} bytes) using ${policy} policy`);
  }

  private sortForEviction(entries: [string, CacheEntry][], policy: string): [string, CacheEntry][] {
    switch (policy) {
      case 'lru':
        return entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
      
      case 'lfu':
        return entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
      
      case 'ttl':
        return entries.sort((a, b) => a[1].expiresAt.getTime() - b[1].expiresAt.getTime());
      
      case 'priority':
        const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        return entries.sort((a, b) => {
          const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
        });
      
      default:
        return entries;
    }
  }

  // Compression
  private setupCompressionWorker(): void {
    try {
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data, id } = e.data;
          
          if (type === 'compress') {
            // Simple compression simulation
            const compressed = btoa(JSON.stringify(data));
            self.postMessage({ type: 'compressed', data: compressed, id });
          } else if (type === 'decompress') {
            try {
              const decompressed = JSON.parse(atob(data));
              self.postMessage({ type: 'decompressed', data: decompressed, id });
            } catch (error) {
              self.postMessage({ type: 'error', error: error.message, id });
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.compressionWorker = new Worker(URL.createObjectURL(blob));

    } catch (error) {
      console.warn('GPS51CacheOptimizer: Could not setup compression worker:', error);
    }
  }

  private async compress<T>(data: T): Promise<any> {
    if (!this.compressionWorker) {
      // Fallback compression
      return {
        _compressed: true,
        data: btoa(JSON.stringify(data))
      };
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36);
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage);
          if (e.data.type === 'compressed') {
            resolve({
              _compressed: true,
              data: e.data.data
            });
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({ type: 'compress', data, id });
    });
  }

  private async decompress<T>(compressedData: any): Promise<T> {
    if (!this.compressionWorker) {
      // Fallback decompression
      return JSON.parse(atob(compressedData.data));
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36);
      
      const handleMessage = (e: MessageEvent) => {
        if (e.data.id === id) {
          this.compressionWorker!.removeEventListener('message', handleMessage);
          if (e.data.type === 'decompressed') {
            resolve(e.data.data);
          } else {
            reject(new Error(e.data.error));
          }
        }
      };

      this.compressionWorker.addEventListener('message', handleMessage);
      this.compressionWorker.postMessage({ type: 'decompress', data: compressedData.data, id });
    });
  }

  private isCompressed(data: any): boolean {
    return data && typeof data === 'object' && data._compressed === true;
  }

  // Persistent Storage
  private async persistEntry(key: string, entry: CacheEntry): Promise<void> {
    try {
      const serializedEntry = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        expiresAt: entry.expiresAt.toISOString(),
        lastAccessed: entry.lastAccessed.toISOString()
      });
      
      localStorage.setItem(`gps51_cache_${key}`, serializedEntry);
    } catch (error) {
      console.warn('GPS51CacheOptimizer: Could not persist entry:', error);
    }
  }

  private async removePersistentEntry(key: string): Promise<void> {
    try {
      localStorage.removeItem(`gps51_cache_${key}`);
    } catch (error) {
      console.warn('GPS51CacheOptimizer: Could not remove persistent entry:', error);
    }
  }

  private async loadPersistentCache(): Promise<void> {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('gps51_cache_'));
      
      for (const storageKey of keys) {
        const cacheKey = storageKey.replace('gps51_cache_', '');
        const serializedEntry = localStorage.getItem(storageKey);
        
        if (serializedEntry) {
          const entry = JSON.parse(serializedEntry);
          entry.timestamp = new Date(entry.timestamp);
          entry.expiresAt = new Date(entry.expiresAt);
          entry.lastAccessed = new Date(entry.lastAccessed);
          
          // Check if still valid
          if (entry.expiresAt > new Date()) {
            this.cache.set(cacheKey, entry);
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      }

      console.log(`GPS51CacheOptimizer: Loaded ${this.cache.size} persistent cache entries`);

    } catch (error) {
      console.warn('GPS51CacheOptimizer: Could not load persistent cache:', error);
    }
  }

  // Utility Methods
  private getStrategy(strategyName: string): CacheStrategy {
    return this.strategies[strategyName] || this.strategies.vehicles;
  }

  private getStrategyFromKey(key: string): string {
    if (key.includes('vehicle')) return 'vehicles';
    if (key.includes('position')) return 'positions';
    if (key.includes('analytics')) return 'analytics';
    return 'metadata';
  }

  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  private getTotalSize(): number {
    let totalSize = 0;
    this.cache.forEach(entry => {
      totalSize += entry.size;
    });
    return totalSize;
  }

  private logAccess(key: string, hit: boolean): void {
    this.accessLog.push({
      key,
      timestamp: new Date(),
      hit
    });

    // Keep only last 10000 access logs
    if (this.accessLog.length > 10000) {
      this.accessLog.splice(0, this.accessLog.length - 10000);
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.removePersistentEntry(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`GPS51CacheOptimizer: Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  private setupEventListeners(): void {
    // Listen for data updates to invalidate cache
    gps51EventBus.on('gps51.vehicles.updated', () => {
      this.invalidateByTag('vehicles');
    });

    gps51EventBus.on('gps51.positions.updated', () => {
      this.invalidateByPattern(/position_/);
    });

    // Clear cache on auth changes
    gps51EventBus.on('gps51.auth.logout', () => {
      this.clear();
    });
  }

  // Public API
  getStats(): CacheStats {
    const recentLogs = this.accessLog.filter(log => 
      log.timestamp > new Date(Date.now() - 300000) // Last 5 minutes
    );

    const hits = recentLogs.filter(log => log.hit).length;
    const total = recentLogs.length;

    return {
      totalEntries: this.cache.size,
      totalSize: this.getTotalSize(),
      hitRate: total > 0 ? (hits / total) * 100 : 0,
      missRate: total > 0 ? ((total - hits) / total) * 100 : 0,
      evictionCount: this.evictionCount,
      avgAccessTime: 0, // Would be calculated from performance metrics
      topKeys: this.getTopAccessedKeys()
    };
  }

  private getTopAccessedKeys(): string[] {
    return Array.from(this.cache.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([key]) => key);
  }

  clear(): void {
    this.cache.clear();
    this.accessLog = [];
    
    // Clear persistent storage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('gps51_cache_'));
    keys.forEach(key => localStorage.removeItem(key));
    
    console.log('GPS51CacheOptimizer: Cache cleared');
  }

  destroy(): void {
    this.clear();
    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
    console.log('GPS51CacheOptimizer: Destroyed');
  }
}

// Create singleton instance
export const gps51CacheOptimizer = new GPS51CacheOptimizer();
