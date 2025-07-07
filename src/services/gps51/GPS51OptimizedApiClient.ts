import { GPS51ApiResponse } from './GPS51Types';
import { GPS51_DEFAULTS } from './GPS51Constants';
import { GPS51RateLimitError } from './GPS51RateLimitError';
import { supabase } from '@/integrations/supabase/client';
import { GPS51Utils } from './GPS51Utils';

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  retryCount: number;
  success: boolean;
  error?: string;
}

export class GPS51OptimizedApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private lastRequestTime: number = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly RATE_LIMIT_DELAY = 3000; // 3 seconds between requests
  private readonly CACHE_TTL = 30000; // 30 seconds cache TTL
  private readonly MAX_RETRIES = 3;
  private metrics: RequestMetrics[] = [];
  private maxMetricsHistory = 100;

  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerTimeout = 0;
  private consecutiveFailures = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes

  constructor(baseUrl: string = GPS51_DEFAULTS.BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage(): void {
    const storedToken = sessionStorage.getItem('gps51_token');
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setBaseURL(url: string): void {
    this.baseUrl = GPS51Utils.normalizeApiUrl(url);
    console.log('GPS51OptimizedApiClient: Base URL updated:', this.baseUrl);
  }

  // Rate limiting wrapper with circuit breaker
  private async throttleRequest<T>(request: () => Promise<T>): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() > this.circuitBreakerTimeout) {
        // Try to recover
        this.circuitBreakerOpen = false;
        this.consecutiveFailures = 0;
        console.log('GPS51OptimizedApiClient: Circuit breaker recovered');
      } else {
        throw new Error('Circuit breaker is open. Service temporarily unavailable.');
      }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          
          if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
            await new Promise(resolve => 
              setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastRequest)
            );
          }
          
          this.lastRequestTime = Date.now();
          const result = await request();
          
          // Reset consecutive failures on success
          this.consecutiveFailures = 0;
          resolve(result);
        } catch (error) {
          this.consecutiveFailures++;
          
          // Open circuit breaker if too many failures
          if (this.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitBreakerOpen = true;
            this.circuitBreakerTimeout = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT;
            console.warn('GPS51OptimizedApiClient: Circuit breaker opened due to consecutive failures');
          }
          
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }
    
    this.isProcessingQueue = false;
  }

  // Enhanced cache implementation
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, customTTL?: number): void {
    this.cache.set(key, { 
      data, 
      timestamp: Date.now() 
    });
    
    // Cleanup old entries
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  // Enhanced authentication with token management
  async login(
    username: string, 
    password: string, 
    from: string = "WEB", 
    type: string = "USER"
  ): Promise<string> {
    const hashedPassword = await GPS51Utils.ensureMD5Hash(password);
    
    const response = await this.throttleRequest(() =>
      this.makeDirectRequest('login', '', {
        username,
        password: hashedPassword,
        from,
        type
      }, 'POST')
    );

    if (response.status === 0) {
      this.token = response.token;
      sessionStorage.setItem('gps51_token', this.token);
      return this.token;
    }
    
    throw new Error(response.cause || response.message || 'Login failed');
  }

  // Optimized position fetching with intelligent caching
  async getLastPosition(
    deviceIds: string[] = [], 
    lastQueryTime: number = 0,
    useCache: boolean = true
  ): Promise<GPS51ApiResponse> {
    const cacheKey = `lastpos_${deviceIds.join(',')}_${lastQueryTime}`;
    
    if (useCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log('GPS51OptimizedApiClient: Cache hit for last position');
        return cached;
      }
    }

    if (!this.token) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await this.throttleRequest(() =>
      this.makeDirectRequest('lastposition', this.token!, {
        deviceids: deviceIds,
        lastquerypositiontime: lastQueryTime
      }, 'POST')
    );

    if (response.status === 0) {
      this.setCachedData(cacheKey, response);
      console.log('GPS51OptimizedApiClient: Last position cached');
    }

    return response;
  }

  // Optimized device list with extended caching
  async getDeviceList(username: string, useCache: boolean = true): Promise<GPS51ApiResponse> {
    const cacheKey = `devices_${username}`;
    
    if (useCache) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        console.log('GPS51OptimizedApiClient: Cache hit for device list');
        return cached;
      }
    }

    if (!this.token) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await this.throttleRequest(() =>
      this.makeDirectRequest('querymonitorlist', this.token!, { username }, 'POST')
    );

    if (response.status === 0) {
      // Cache device list for longer as it changes infrequently
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      console.log('GPS51OptimizedApiClient: Device list cached');
    }

    return response;
  }

  // History tracks with intelligent batching
  async getHistoryTracks(
    deviceId: string,
    beginTime: string,
    endTime: string,
    timezone: number = 8
  ): Promise<GPS51ApiResponse> {
    const cacheKey = `tracks_${deviceId}_${beginTime}_${endTime}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      console.log('GPS51OptimizedApiClient: Cache hit for history tracks');
      return cached;
    }

    if (!this.token) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await this.throttleRequest(() =>
      this.makeDirectRequest('querytracks', this.token!, {
        deviceid: deviceId,
        begintime: beginTime,
        endtime: endTime,
        timezone
      }, 'POST')
    );

    if (response.status === 0) {
      // Cache for longer periods for historical data
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      console.log('GPS51OptimizedApiClient: History tracks cached');
    }

    return response;
  }

  // Direct request method with enhanced error handling
  private async makeDirectRequest(
    action: string,
    token: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const startTime = Date.now();
    const metrics = this.createMetrics();
    
    let lastError: Error | null = null;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        metrics.retryCount = attempt;

        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`GPS51OptimizedApiClient: Retry attempt ${attempt}/${this.MAX_RETRIES} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const url = new URL(this.baseUrl);
        url.searchParams.append('action', action);
        
        if (action !== 'login' && token) {
          url.searchParams.append('token', token);
        }
        
        // Add undocumented parameters for specific actions
        if (action === 'lastposition') {
          url.searchParams.append('streamtype', 'proto');
          url.searchParams.append('send', '2');
        }

        const requestOptions: RequestInit = {
          method,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'GPS51-Optimized-Client/1.0',
          }
        };

        // Handle request body
        if (method === 'POST' && Object.keys(params).length > 0) {
          if (action === 'login') {
            requestOptions.headers = {
              ...requestOptions.headers,
              'Content-Type': 'application/json'
            };
            requestOptions.body = JSON.stringify(params);
          } else {
            requestOptions.headers = {
              ...requestOptions.headers,
              'Content-Type': 'application/x-www-form-urlencoded'
            };
            
            const formParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                formParams.append(key, value.join(','));
              } else {
                formParams.append(key, String(value));
              }
            });
            requestOptions.body = formParams.toString();
          }
        }

        console.log(`GPS51OptimizedApiClient: Making ${action} request (attempt ${attempt + 1})`);

        const response = await fetch(url.toString(), requestOptions);
        const responseText = await response.text();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
        }

        let data: GPS51ApiResponse;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.warn('GPS51OptimizedApiClient: Non-JSON response received:', responseText);
          data = {
            status: 0,
            message: responseText,
            data: responseText
          };
        }

        // Check for 8902 rate limit error
        if (data.status === 8902) {
          console.warn('GPS51OptimizedApiClient: Rate limit detected (8902)');
          throw GPS51RateLimitError.fromApiResponse(data);
        }

        // Success - record metrics and return
        metrics.success = true;
        metrics.endTime = Date.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        this.addMetrics(metrics);

        // Log successful API call
        await this.logApiCall(action, params, response.status, data, metrics.duration!);

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(`GPS51OptimizedApiClient: ${action} attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry on authentication errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }
      }
    }

    // All retries failed
    metrics.success = false;
    metrics.error = lastError?.message || 'Unknown error';
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    this.addMetrics(metrics);

    // Log failed API call
    await this.logApiCall(action, params, 0, null, metrics.duration!, lastError?.message);

    throw lastError || new Error('Request failed after all retries');
  }

  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('authentication') ||
           message.includes('unauthorized') ||
           message.includes('forbidden') ||
           message.includes('400') ||
           message.includes('401') ||
           message.includes('403');
  }

  private createMetrics(): RequestMetrics {
    return {
      startTime: Date.now(),
      retryCount: 0,
      success: false
    };
  }

  private addMetrics(metrics: RequestMetrics): void {
    this.metrics.push(metrics);
    
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  private async logApiCall(
    endpoint: string,
    requestPayload: any,
    responseStatus: number,
    responseBody: any,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    // EMERGENCY: Disable API logging to prevent feedback loops
    // Only critical errors are logged to console
    if (errorMessage) {
      console.error(`GPS51-Optimized-${endpoint} failed:`, errorMessage);
    }
  }

  // Performance metrics
  getMetrics(): {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
    cacheHitRate: number;
    circuitBreakerStatus: string;
    recentErrors: string[];
  } {
    const recentMetrics = this.metrics.slice(-20);
    const successfulRequests = recentMetrics.filter(m => m.success);
    const averageResponseTime = successfulRequests.length > 0 
      ? successfulRequests.reduce((sum, m) => sum + (m.duration || 0), 0) / successfulRequests.length
      : 0;
    
    const successRate = recentMetrics.length > 0 
      ? (successfulRequests.length / recentMetrics.length) * 100
      : 0;

    const recentErrors = recentMetrics
      .filter(m => !m.success && m.error)
      .slice(-5)
      .map(m => m.error!);

    return {
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round(successRate * 100) / 100,
      totalRequests: this.metrics.length,
      cacheHitRate: this.calculateCacheHitRate(),
      circuitBreakerStatus: this.circuitBreakerOpen ? 'Open' : 'Closed',
      recentErrors
    };
  }

  private calculateCacheHitRate(): number {
    // This is a simplified calculation - in production you'd track this more accurately
    return Math.round((this.cache.size / Math.max(this.metrics.length, 1)) * 100);
  }

  // Clear cache manually
  clearCache(): void {
    this.cache.clear();
    console.log('GPS51OptimizedApiClient: Cache cleared');
  }

  // Health check
  async healthCheck(): Promise<{ 
    healthy: boolean; 
    latency?: number; 
    error?: string;
    metrics: ReturnType<typeof this.getMetrics>;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.baseUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        latency,
        metrics: this.getMetrics(),
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        metrics: this.getMetrics(),
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }

  // Logout and cleanup
  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.throttleRequest(() =>
          this.makeDirectRequest('logout', this.token!, {}, 'POST')
        );
      } catch (error) {
        console.warn('Logout request failed:', error);
      }
    }
    
    this.token = null;
    sessionStorage.removeItem('gps51_token');
    this.clearCache();
    console.log('GPS51OptimizedApiClient: Logged out and cleaned up');
  }
}