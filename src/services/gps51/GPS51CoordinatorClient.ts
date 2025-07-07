import { supabase } from '@/integrations/supabase/client';
import { GPS51Device, GPS51Position } from './types';

interface CoordinatorRequest {
  action: string;
  params: any;
  priority?: 'high' | 'normal' | 'low';
}

interface CoordinatorResponse {
  success: boolean;
  data?: any;
  error?: string;
  fromCache?: boolean;
  cacheAge?: number;
  emergencyStop?: boolean;
  cooldownRemaining?: number;
  rateLimitDetected?: boolean;
}

export class GPS51CoordinatorClient {
  private static instance: GPS51CoordinatorClient;
  private requestQueue: Map<string, Promise<CoordinatorResponse>> = new Map();

  static getInstance(): GPS51CoordinatorClient {
    if (!GPS51CoordinatorClient.instance) {
      GPS51CoordinatorClient.instance = new GPS51CoordinatorClient();
    }
    return GPS51CoordinatorClient.instance;
  }

  /**
   * Send a request through the GPS51 coordinator with deduplication
   */
  async sendRequest(request: CoordinatorRequest): Promise<CoordinatorResponse> {
    // Create a unique key for request deduplication
    const requestKey = `${request.action}:${JSON.stringify(request.params)}`;
    
    // Check if the same request is already in flight
    const existingRequest = this.requestQueue.get(requestKey);
    if (existingRequest) {
      console.log('GPS51CoordinatorClient: Deduplicating request:', requestKey);
      return existingRequest;
    }

    // Create the request promise
    const requestPromise = this.executeRequest(request);
    
    // Store in queue for deduplication
    this.requestQueue.set(requestKey, requestPromise);
    
    // Clean up after completion
    requestPromise.finally(() => {
      this.requestQueue.delete(requestKey);
    });

    return requestPromise;
  }

  private async executeRequest(request: CoordinatorRequest): Promise<CoordinatorResponse> {
    try {
      // EMERGENCY SPIKE ELIMINATION: Reduce logging to prevent API monitoring spikes
      // console.log('GPS51CoordinatorClient: Sending request to coordinator:', {
      //   action: request.action,
      //   priority: request.priority || 'normal'
      // });

      const { data, error } = await supabase.functions.invoke('gps51-coordinator', {
        body: {
          action: request.action,
          params: request.params,
          priority: request.priority || 'normal',
          requesterId: crypto.randomUUID()
        }
      });

      if (error) {
        console.error('GPS51CoordinatorClient: Request failed:', error);
        return {
          success: false,
          error: error.message || 'Request failed'
        };
      }

      // Handle rate limiting with automatic retry for short wait times
      if (data && data.shouldWait && data.waitTime) {
        console.warn(`GPS51CoordinatorClient: Rate limited, wait time: ${data.waitTime}ms`);
        
        // Auto-retry for waits under 10 seconds
        if (data.waitTime < 10000) {
          console.log('GPS51CoordinatorClient: Auto-retrying after rate limit wait');
          await new Promise(resolve => setTimeout(resolve, data.waitTime));
          return this.executeRequest(request);
        }
      }

      // Handle emergency stop
      if (data && data.emergencyStop) {
        console.error('GPS51CoordinatorClient: Emergency stop detected');
        return {
          success: false,
          error: 'GPS51 emergency stop is active',
          emergencyStop: true
        };
      }

      if (data && data.fromCache) {
        console.log('GPS51CoordinatorClient: Response from cache, age:', data.cacheAge + 'ms');
      }

      return data || { success: false, error: 'No data received' };
    } catch (error) {
      console.error('GPS51CoordinatorClient: Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Authenticate with GPS51 through coordinator
   */
  async authenticate(credentials: {
    username: string;
    password: string;
    apiUrl?: string;
    from?: string;
    type?: string;
  }): Promise<CoordinatorResponse> {
    return this.sendRequest({
      action: 'authenticate',
      params: credentials,
      priority: 'high'
    });
  }

  /**
   * Get device list through coordinator
   */
  async getDeviceList(): Promise<GPS51Device[]> {
    const response = await this.sendRequest({
      action: 'getDeviceList',
      params: {},
      priority: 'normal'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get device list');
    }

    return response.data || [];
  }

  /**
   * Get real-time positions through coordinator with intelligent caching
   */
  async getRealtimePositions(
    deviceIds: string[], 
    lastQueryTime?: number
  ): Promise<{ positions: GPS51Position[]; lastQueryTime: number }> {
    const response = await this.sendRequest({
      action: 'getRealtimePositions',
      params: { deviceIds, lastQueryTime },
      priority: 'normal'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get realtime positions');
    }

    return response.data || { positions: [], lastQueryTime: Date.now() };
  }

  /**
   * Send vehicle command through coordinator
   */
  async sendCommand(
    deviceId: string,
    command: string,
    params?: any
  ): Promise<CoordinatorResponse> {
    return this.sendRequest({
      action: 'sendCommand',
      params: { deviceId, command, params },
      priority: 'high'
    });
  }

  /**
   * Get last position for a device through coordinator
   */
  async getLastPosition(deviceId: string): Promise<GPS51Position | null> {
    const response = await this.sendRequest({
      action: 'getLastPosition',
      params: { deviceId },
      priority: 'normal'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get last position');
    }

    return response.data || null;
  }

  /**
   * Batch request for multiple devices
   */
  async batchRequest(requests: CoordinatorRequest[]): Promise<CoordinatorResponse[]> {
    // Execute all requests in parallel with deduplication
    const promises = requests.map(req => this.sendRequest(req));
    return Promise.all(promises);
  }

  /**
   * Check coordinator status
   */
  async getCoordinatorStatus(): Promise<{
    queueSize: number;
    lastRequest: string | null;
    circuitBreakerOpen: boolean;
    cacheHitRate: number;
  }> {
    const response = await this.sendRequest({
      action: 'getStatus',
      params: {},
      priority: 'low'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get coordinator status');
    }

    return response.data || {
      queueSize: 0,
      lastRequest: null,
      circuitBreakerOpen: false,
      cacheHitRate: 0
    };
  }

  /**
   * Clear all pending requests (emergency stop)
   */
  clearAllRequests(): void {
    console.log('GPS51CoordinatorClient: Clearing all pending requests');
    this.requestQueue.clear();
  }
}

export const gps51CoordinatorClient = GPS51CoordinatorClient.getInstance();