/**
 * GPS51 Production Service - Single Entry Point
 * Consolidates all GPS51 operations into one authoritative service
 * Eliminates redundancy and provides reliable, coordinated API access
 */

import { GPS51ConfigStorage } from './configStorage';
import { GPS51CredentialChecker } from './GPS51CredentialChecker';
import { gps51SimpleAuthSync } from './GPS51SimpleAuthSync';
import { gps51PerformanceOptimizer } from './GPS51PerformanceOptimizer';

export interface GPS51Vehicle {
  deviceid: string;
  devicename: string;
  simnum: string;
  lastactivetime: string;
  position?: GPS51Position;
  isMoving: boolean;
  speed: number;
  lastUpdate: Date;
  status: string;
  devicetype?: string;
  overduetime?: number;
  remark?: string;
}

export interface GPS51Position {
  deviceid: string;
  devicetime: number;
  arrivedtime?: number;
  updatetime: number;
  callat: number; // latitude
  callon: number; // longitude
  altitude: number;
  radius: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number; // 1 = moving, 0 = stopped
  strstatus: string;
  strstatusen: string; // English status
  alarm?: number;
  stralarm?: string;
  stralarmen: string; // English alarm
  totaloil?: number;
  temp1?: number;
  temp2?: number;
  voltagepercent?: number;
}

export interface GPS51AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  error?: string;
}

export interface LiveDataResult {
  vehicles: GPS51Vehicle[];
  positions: GPS51Position[];
  lastQueryTime: number;
  isEmpty: boolean;
  isSuccess: boolean;
  error?: string;
}

export class GPS51ProductionService {
  private static instance: GPS51ProductionService;
  
  // Core state
  private authState: GPS51AuthState = {
    isAuthenticated: false,
    token: null,
    username: null
  };
  
  private vehicles: GPS51Vehicle[] = [];
  private lastQueryTime: number = 0;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  
  // API configuration
  private readonly apiUrl = 'https://api.gps51.com/openapi';
  private readonly minRequestInterval = 30000; // 30 seconds minimum
  private lastRequestTime = 0;

  private constructor() {
    console.log('GPS51ProductionService: Initializing production service');
  }

  static getInstance(): GPS51ProductionService {
    if (!GPS51ProductionService.instance) {
      GPS51ProductionService.instance = new GPS51ProductionService();
    }
    return GPS51ProductionService.instance;
  }

  /**
   * Authenticate with GPS51 API
   * Single source of truth for authentication
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    try {
      console.log('GPS51ProductionService: Starting authentication for', username);
      
      // Validate credentials format
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      // Use performance optimizer for rate limiting and retry logic
      const result = await gps51PerformanceOptimizer.retryWithBackoff(async () => {
        if (!gps51PerformanceOptimizer.canMakeRequest()) {
          const waitTime = gps51PerformanceOptimizer.getNextAvailableRequestTime();
          if (waitTime > 0) {
            console.log(`GPS51ProductionService: Rate limiting - waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        // Call GPS51 login API through Edge Function
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('gps51-auth', {
          body: {
            action: 'login',
            username,
            password,
            from: 'WEB',
            type: 'USER'
          }
        });

        if (error) {
          throw new Error(`Authentication failed: ${error.message}`);
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Authentication failed');
        }

        return data;
      });

      // Update authentication state
      this.authState = {
        isAuthenticated: true,
        token: result.token,
        username
      };

      // Store username for other services
      localStorage.setItem('gps51_username', username);
      
      // Notify auth sync
      gps51SimpleAuthSync.notifyAuthSuccess(username);

      console.log('GPS51ProductionService: Authentication successful');
      return this.authState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.authState = {
        isAuthenticated: false,
        token: null,
        username: null,
        error: errorMessage
      };

      console.error('GPS51ProductionService: Authentication failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Fetch user devices
   * Single source of truth for device discovery
   */
  async fetchUserDevices(): Promise<GPS51Vehicle[]> {
    if (!this.authState.isAuthenticated || !this.authState.username) {
      throw new Error('Not authenticated - call authenticate() first');
    }

    try {
      console.log('GPS51ProductionService: Fetching user devices');
      
      await this.enforceRateLimit();

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'querymonitorlist',
          username: this.authState.username,
          token: this.authState.token
        }
      });

      if (error) {
        throw new Error(`Failed to fetch devices: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch devices');
      }

      // Process device response
      let devices: any[] = [];
      
      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            devices = devices.concat(group.devices);
          }
        });
      } else if (data.devices && Array.isArray(data.devices)) {
        devices = data.devices;
      }

      // Transform to GPS51Vehicle format
      this.vehicles = devices.map(device => ({
        deviceid: device.deviceid,
        devicename: device.devicename || `Device ${device.deviceid}`,
        simnum: device.simnum || '',
        lastactivetime: device.lastactivetime || '',
        devicetype: device.devicetype,
        overduetime: device.overduetime,
        remark: device.remark,
        isMoving: false,
        speed: 0,
        lastUpdate: new Date(),
        status: 'unknown'
      }));

      console.log('GPS51ProductionService: Retrieved', this.vehicles.length, 'devices');
      return this.vehicles;

    } catch (error) {
      console.error('GPS51ProductionService: Failed to fetch devices:', error);
      throw error;
    }
  }

  /**
   * Fetch live positions with smart tracking
   * Single source of truth for position data
   */
  async fetchLivePositions(deviceIds?: string[]): Promise<LiveDataResult> {
    // Auto-authenticate if needed
    if (!this.authState.isAuthenticated) {
      await this.autoAuthenticate();
    }

    try {
      const targetDeviceIds = deviceIds || this.vehicles.map(d => d.deviceid);
      
      if (targetDeviceIds.length === 0) {
        return {
          vehicles: [],
          positions: [],
          lastQueryTime: this.lastQueryTime,
          isEmpty: true,
          isSuccess: true
        };
      }

      console.log('GPS51ProductionService: Fetching positions for', targetDeviceIds.length, 'devices');
      console.log('GPS51ProductionService: Using lastquerypositiontime:', this.lastQueryTime);

      await this.enforceRateLimit();

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'lastposition',
          deviceids: targetDeviceIds,
          lastquerypositiontime: this.lastQueryTime || undefined,
          token: this.authState.token
        }
      });

      if (error) {
        throw new Error(`Failed to fetch positions: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch positions');
      }

      // Update lastQueryTime from server response
      this.lastQueryTime = data.lastquerypositiontime || Date.now();

      // Extract positions
      const positions: GPS51Position[] = (data.records || []).map((record: any) => ({
        deviceid: record.deviceid,
        devicetime: record.devicetime || record.updatetime || 0,
        arrivedtime: record.arrivedtime,
        updatetime: record.updatetime || 0,
        callat: record.callat || 0,
        callon: record.callon || 0,
        altitude: record.altitude || 0,
        radius: record.radius || 5,
        speed: record.speed || 0,
        course: record.course || 0,
        totaldistance: record.totaldistance || 0,
        status: record.status || 0,
        moving: record.moving || 0,
        strstatus: record.strstatus || record.strstatusen || 'Unknown',
        strstatusen: record.strstatusen || 'Unknown',
        alarm: record.alarm,
        stralarm: record.stralarm,
        stralarmen: record.stralarmen || 'No alarm',
        totaloil: record.totaloil,
        temp1: record.temp1,
        temp2: record.temp2,
        voltagepercent: record.voltagepercent
      }));

      // Update vehicles with position data
      const updatedVehicles = this.vehicles.map(vehicle => {
        const position = positions.find(p => p.deviceid === vehicle.deviceid);
        return {
          ...vehicle,
          position,
          isMoving: position ? position.moving === 1 : false,
          speed: position ? position.speed : 0,
          lastUpdate: new Date(),
          status: position ? position.strstatusen : 'offline'
        };
      });

      this.vehicles = updatedVehicles;
      this.retryCount = 0; // Reset on success

      console.log('GPS51ProductionService: Position fetch completed', {
        positionsReceived: positions.length,
        newLastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0
      });

      return {
        vehicles: updatedVehicles,
        positions,
        lastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        isSuccess: true
      };

    } catch (error) {
      this.retryCount++;
      const errorMessage = error instanceof Error ? error.message : 'Position fetch failed';
      
      console.error('GPS51ProductionService: Position fetch failed:', error);
      
      return {
        vehicles: this.vehicles,
        positions: [],
        lastQueryTime: this.lastQueryTime,
        isEmpty: true,
        isSuccess: false,
        error: errorMessage
      };
    }
  }

  /**
   * Auto-authenticate using stored credentials
   */
  private async autoAuthenticate(): Promise<void> {
    const credentialStatus = GPS51CredentialChecker.checkCredentials();
    
    if (!credentialStatus.isConfigured) {
      throw new Error('GPS51 credentials not configured');
    }

    const config = GPS51ConfigStorage.getConfiguration();
    if (!config || !config.password) {
      throw new Error('GPS51 configuration incomplete');
    }

    await this.authenticate(config.username, config.password);
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`GPS51ProductionService: Rate limiting - waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Calculate smart polling interval
   */
  calculatePollingInterval(): number {
    const movingVehicles = this.vehicles.filter(v => v.isMoving);
    const stationaryVehicles = this.vehicles.filter(v => !v.isMoving && v.status !== 'offline');
    
    if (movingVehicles.length > 0) {
      return 30000; // 30 seconds for moving vehicles
    } else if (stationaryVehicles.length > 0) {
      return 45000; // 45 seconds for stationary vehicles
    }
    
    return 60000; // 60 seconds default
  }

  /**
   * Calculate retry delay
   */
  calculateRetryDelay(): number {
    if (this.retryCount === 0) return 0;
    return Math.min(1000 * Math.pow(2, this.retryCount), 30000);
  }

  /**
   * Check if retry should be attempted
   */
  shouldRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  /**
   * Get current authentication state
   */
  getAuthState(): GPS51AuthState {
    return { ...this.authState };
  }

  /**
   * Get current devices
   */
  getDevices(): GPS51Vehicle[] {
    return [...this.vehicles];
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      isAuthenticated: this.authState.isAuthenticated,
      username: this.authState.username,
      deviceCount: this.vehicles.length,
      lastQueryTime: this.lastQueryTime,
      retryCount: this.retryCount,
      movingVehicles: this.vehicles.filter(v => v.isMoving).length,
      stationaryVehicles: this.vehicles.filter(v => !v.isMoving && v.status !== 'offline').length,
      offlineVehicles: this.vehicles.filter(v => v.status === 'offline').length,
      minRequestInterval: this.minRequestInterval,
      timeSinceLastRequest: Date.now() - this.lastRequestTime
    };
  }

  /**
   * Reset query time
   */
  resetQueryTime(): void {
    this.lastQueryTime = 0;
    console.log('GPS51ProductionService: Query time reset');
  }

  /**
   * Logout and clear state
   */
  async logout(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      token: null,
      username: null
    };
    this.vehicles = [];
    this.lastQueryTime = 0;
    this.retryCount = 0;
    
    localStorage.removeItem('gps51_username');
    gps51SimpleAuthSync.notifyLogout();
    
    console.log('GPS51ProductionService: Logged out and reset');
  }
}

// Export singleton instance
export const gps51ProductionService = GPS51ProductionService.getInstance();