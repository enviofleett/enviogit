/**
 * EMERGENCY GPS51 CLIENT WITH AGGRESSIVE CACHING
 * Based on analysis of network traffic showing massive API overload
 */

import { EmergencyGPS51RateLimiter } from './EmergencyGPS51RateLimiter';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export class EmergencyGPS51Client {
  private baseUrl: string;
  private token: string | null = null;
  private rateLimiter = new EmergencyGPS51RateLimiter();
  private cache = new Map<string, CacheEntry>();
  private readonly EMERGENCY_CACHE_TTL = 60000; // 1 minute emergency cache

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken(): void {
    this.token = sessionStorage.getItem('gps51_token');
  }

  private saveToken(token: string): void {
    this.token = token;
    sessionStorage.setItem('gps51_token', token);
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`🟢 CACHE HIT: ${key}`);
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
      console.log(`🟡 CACHE EXPIRED: ${key}`);
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number = this.EMERGENCY_CACHE_TTL): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
    console.log(`🔵 CACHED: ${key} for ${ttl}ms`);
  }

  // EMERGENCY LOGIN - ONLY CALL ONCE
  async login(username: string, password: string): Promise<string> {
    const cacheKey = `login_${username}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    console.log('🚨 EMERGENCY LOGIN - Using Supabase Proxy to avoid CORS');
    
    const hashedPassword = await this.md5Hash(password);
    
    const result = await this.rateLimiter.addRequest(async () => {
      // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'login',
          params: {
            username,
            password: hashedPassword,
            from: "WEB",
            type: "USER"
          },
          method: 'POST',
          apiUrl: this.baseUrl
        }
      });

      if (proxyError) {
        throw new Error(`Proxy request failed: ${proxyError.message}`);
      }

      const data = proxyResponse;
      
      if (data.status !== 0) {
        throw new Error(data.cause || 'Login failed');
      }

      this.saveToken(data.token);
      this.setCachedData(cacheKey, data.token, 3600000); // Cache for 1 hour
      return data.token;
    }, 10); // Highest priority

    return result;
  }

  // EMERGENCY DEVICE LIST - CACHE FOR 10 MINUTES
  async getDeviceList(username: string, forceRefresh: boolean = false): Promise<any> {
    const cacheKey = `devices_${username}`;
    
    if (!forceRefresh) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    console.log('🚨 EMERGENCY DEVICE LIST - Rate Limited');

    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const result = await this.rateLimiter.addRequest(async () => {
      // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'querymonitorlist',
          token: this.token,
          params: { username },
          method: 'POST',
          apiUrl: this.baseUrl
        }
      });

      if (proxyError) {
        throw new Error(`Proxy request failed: ${proxyError.message}`);
      }

      const data = proxyResponse;
      
      if (data.status !== 0) {
        throw new Error(data.cause || 'Failed to get device list');
      }

      // Enhanced device extraction with multiple fallback strategies
      console.log('🔍 EmergencyGPS51Client: Analyzing device response structure:', {
        status: data.status,
        hasGroups: !!data.groups,
        groupsIsArray: Array.isArray(data.groups),
        groupsLength: Array.isArray(data.groups) ? data.groups.length : 0,
        hasDevices: !!data.devices,
        devicesIsArray: Array.isArray(data.devices),
        hasData: !!data.data,
        responseKeys: Object.keys(data)
      });

      // Cache device list for 10 minutes during emergency
      this.setCachedData(cacheKey, data, 600000);
      return data;
    }, 8);

    return result;
  }

  // EMERGENCY POSITION FETCHING - BATCH ALL DEVICES
  async getLastPosition(
    deviceIds: string[], 
    lastQueryTime: number = 0,
    forceRefresh: boolean = false
  ): Promise<any> {
    if (deviceIds.length === 0) return { records: [] };

    // Create cache key based on device IDs and time window (1 minute)
    const timeWindow = Math.floor(Date.now() / 60000); // 1-minute windows
    const cacheKey = `positions_${deviceIds.sort().join(',')}_${timeWindow}`;
    
    if (!forceRefresh) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    console.log(`🚨 EMERGENCY POSITION FETCH - ${deviceIds.length} devices - Rate Limited`);

    if (!this.token) {
      throw new Error('Not authenticated');
    }

    // CRITICAL: Batch ALL devices in ONE request
    const result = await this.rateLimiter.addRequest(async () => {
      // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'lastposition',
          token: this.token,
          params: {
            deviceids: deviceIds.join(','), // GPS51 API expects comma-separated string
            lastquerypositiontime: lastQueryTime
          },
          method: 'POST',
          apiUrl: this.baseUrl
        }
      });

      if (proxyError) {
        throw new Error(`Proxy request failed: ${proxyError.message}`);
      }

      const data = proxyResponse;
      
      if (data.status !== 0) {
        throw new Error(data.cause || 'Failed to get positions');
      }

      // Cache aggressively during emergency - 1 minute
      this.setCachedData(cacheKey, data, 60000);
      return data;
    }, 9); // High priority

    return result;
  }

  // EMERGENCY HISTORY TRACKS - CACHE FOR 1 HOUR
  async getHistoryTracks(
    deviceId: string,
    beginTime: string,
    endTime: string,
    timezone: number = 8
  ): Promise<any> {
    const cacheKey = `tracks_${deviceId}_${beginTime}_${endTime}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    console.log('🚨 EMERGENCY HISTORY TRACKS - Rate Limited');

    if (!this.token) {
      throw new Error('Not authenticated');
    }

    const result = await this.rateLimiter.addRequest(async () => {
      // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'querytracks',
          token: this.token,
          params: {
            deviceid: deviceId,
            begintime: beginTime,
            endtime: endTime,
            timezone
          },
          method: 'POST',
          apiUrl: this.baseUrl
        }
      });

      if (proxyError) {
        throw new Error(`Proxy request failed: ${proxyError.message}`);
      }

      const data = proxyResponse;
      
      if (data.status !== 0) {
        throw new Error(data.cause || 'Failed to get tracks');
      }

      // Cache historical data for 1 hour
      this.setCachedData(cacheKey, data, 3600000);
      return data;
    }, 5);

    return result;
  }

  private async md5Hash(input: string): Promise<string> {
    // Use GPS51Utils MD5 implementation to fix browser compatibility
    const { GPS51Utils } = await import('../GPS51Utils');
    return GPS51Utils.ensureMD5Hash(input);
  }

  // Emergency diagnostics
  getDiagnostics() {
    return {
      queueSize: this.rateLimiter.getQueueSize(),
      cacheSize: this.cache.size,
      cacheEntries: Array.from(this.cache.keys()),
      isAuthenticated: !!this.token
    };
  }

  // Emergency cache clear
  clearAllCaches(): void {
    this.cache.clear();
    this.rateLimiter.clearQueue();
    console.log('🧹 EMERGENCY: All caches cleared');
  }

  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.rateLimiter.addRequest(async () => {
          // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
          const { supabase } = await import('@/integrations/supabase/client');
          
          const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
            body: {
              action: 'logout',
              token: this.token,
              params: {},
              method: 'POST',
              apiUrl: this.baseUrl
            }
          });

          if (proxyError) {
            console.warn('Proxy logout failed:', proxyError);
          }
          
          return proxyResponse;
        }, 10);
      } catch (error) {
        console.warn('Logout failed:', error);
      }
    }
    
    this.token = null;
    sessionStorage.removeItem('gps51_token');
    this.clearAllCaches();
  }
}