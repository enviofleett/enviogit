/**
 * GPS51 Unified Live Data Service
 * Implements the exact GPS51 API logic flow as specified:
 * 1. Login -> Store token
 * 2. Query device list (querymonitorlist)
 * 3. Smart polling with lastquerypositiontime tracking
 * 4. Adaptive intervals based on vehicle movement
 */

import { EmergencyGPS51Client } from './emergency/EmergencyGPS51Client';
import { gps51SimpleAuthSync } from './GPS51SimpleAuthSync';

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

export interface LiveDataResult {
  vehicles: GPS51Vehicle[];
  positions: GPS51Position[];
  lastQueryTime: number;
  isEmpty: boolean;
  isSuccess: boolean;
  error?: string;
}

export interface GPS51AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  error?: string;
}

export class GPS51UnifiedLiveDataService {
  private static instance: GPS51UnifiedLiveDataService;
  private client: EmergencyGPS51Client;
  private lastQueryTime: number = 0;
  private devices: GPS51Vehicle[] = [];
  private authState: GPS51AuthState = {
    isAuthenticated: false,
    token: null,
    username: null
  };
  private retryCount: number = 0;
  private maxRetries: number = 3;

  private constructor() {
    // Use the default GPS51 API URL - can be configured later
    this.client = new EmergencyGPS51Client('https://www.gps51.com:9015/RCSWebAPI/');
    console.log('GPS51UnifiedLiveDataService: Initialized with emergency client');
  }

  static getInstance(): GPS51UnifiedLiveDataService {
    if (!GPS51UnifiedLiveDataService.instance) {
      GPS51UnifiedLiveDataService.instance = new GPS51UnifiedLiveDataService();
    }
    return GPS51UnifiedLiveDataService.instance;
  }

  /**
   * Step 1: Authenticate user and store token
   * Implements the exact login flow from GPS51 API specification
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    try {
      console.log('GPS51UnifiedLiveDataService: Starting authentication for', username);
      
      // Call login API - password should already be MD5 hashed
      const token = await this.client.login(username, password);
      
      this.authState = {
        isAuthenticated: true,
        token,
        username
      };

      // CRITICAL FIX: Store username in localStorage for GPS51Client access
      localStorage.setItem('gps51_username', username);
      console.log('GPS51UnifiedLiveDataService: Username stored in localStorage for GPS51Client access');

      // CRITICAL FIX: Use simple auth sync to prevent circular loops
      gps51SimpleAuthSync.notifyAuthSuccess(username);

      console.log('GPS51UnifiedLiveDataService: Authentication successful');
      return this.authState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.authState = {
        isAuthenticated: false,
        token: null,
        username: null,
        error: errorMessage
      };

      console.error('GPS51UnifiedLiveDataService: Authentication failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Step 2: Fetch user's affiliated devices (vehicles)
   * Implements querymonitorlist API call
   */
  async fetchUserDevices(): Promise<GPS51Vehicle[]> {
    if (!this.authState.isAuthenticated || !this.authState.username) {
      throw new Error('Not authenticated - call authenticate() first');
    }

    try {
      console.log('GPS51UnifiedLiveDataService: Fetching user devices for', this.authState.username);
      
      const deviceResponse = await this.client.getDeviceList(this.authState.username);
      
      // Extract devices from response structure
      let devices: any[] = [];
      
      if (deviceResponse.groups && Array.isArray(deviceResponse.groups)) {
        // Extract devices from groups structure
        deviceResponse.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            devices = devices.concat(group.devices);
          }
        });
      } else if (deviceResponse.devices && Array.isArray(deviceResponse.devices)) {
        devices = deviceResponse.devices;
      }

      // Transform to GPS51Vehicle format
      this.devices = devices.map(device => ({
        deviceid: device.deviceid,
        devicename: device.devicename || `Device ${device.deviceid}`,
        simnum: device.simnum || '',
        lastactivetime: device.lastactivetime || '',
        isMoving: false,
        speed: 0,
        lastUpdate: new Date(),
        status: 'unknown'
      }));

      console.log('GPS51UnifiedLiveDataService: Retrieved', this.devices.length, 'devices');
      return this.devices;

    } catch (error) {
      console.error('GPS51UnifiedLiveDataService: Failed to fetch devices:', error);
      throw error;
    }
  }

  /**
   * Step 3: Fetch live positions with lastquerypositiontime tracking
   * ENHANCED: Now uses request coordinator to prevent rate limiting
   */
  async fetchLivePositions(deviceIds?: string[]): Promise<LiveDataResult> {
    if (!this.authState.isAuthenticated) {
      throw new Error('Not authenticated - call authenticate() first');
    }

    try {
      // Use provided deviceIds or all user devices
      const targetDeviceIds = deviceIds || this.devices.map(d => d.deviceid);
      
      if (targetDeviceIds.length === 0) {
        return {
          vehicles: [],
          positions: [],
          lastQueryTime: this.lastQueryTime,
          isEmpty: true,
          isSuccess: true
        };
      }

      console.log('GPS51UnifiedLiveDataService: Fetching positions for', targetDeviceIds.length, 'devices');
      console.log('GPS51UnifiedLiveDataService: Using lastquerypositiontime:', this.lastQueryTime);

      // ENHANCED: Use request coordinator instead of direct client call
      const { gps51RequestCoordinator } = await import('./GPS51RequestCoordinator');
      const positionResponse = await gps51RequestCoordinator.queueRequest(
        'positions',
        {
          deviceIds: targetDeviceIds,
          lastQueryTime: this.lastQueryTime
        },
        7 // High priority for live position data
      );

      // CRITICAL: Update lastQueryTime from server response for next call
      this.lastQueryTime = (positionResponse as any).lastquerypositiontime || this.lastQueryTime;

      // Extract positions from response
      const positions: GPS51Position[] = ((positionResponse as any).records || []).map((record: any) => ({
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
      const updatedVehicles = this.devices.map(vehicle => {
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

      this.devices = updatedVehicles;
      this.retryCount = 0; // Reset retry count on success

      console.log('GPS51UnifiedLiveDataService: Position fetch completed', {
        positionsReceived: positions.length,
        newLastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        serverTimestamp: new Date(this.lastQueryTime).toISOString()
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
      
      console.error('GPS51UnifiedLiveDataService: Position fetch failed:', error);
      
      return {
        vehicles: this.devices,
        positions: [],
        lastQueryTime: this.lastQueryTime,
        isEmpty: true,
        isSuccess: false,
        error: errorMessage
      };
    }
  }

  /**
   * Calculate smart polling interval based on vehicle activity
   * FIXED: Increased intervals to 30-60 seconds minimum to prevent rate limiting
   * Moving vehicles: 30 seconds minimum
   * Stationary vehicles: 45 seconds
   * Offline vehicles: 60 seconds
   */
  calculatePollingInterval(): number {
    const movingVehicles = this.devices.filter(v => v.isMoving);
    const stationaryVehicles = this.devices.filter(v => !v.isMoving && v.status !== 'offline');
    const offlineVehicles = this.devices.filter(v => v.status === 'offline');

    if (movingVehicles.length > 0) {
      return 30000; // 30 seconds for moving vehicles (was 5s)
    } else if (stationaryVehicles.length > 0) {
      return 45000; // 45 seconds for stationary vehicles (was 10s)
    } else if (offlineVehicles.length > 0) {
      return 60000; // 60 seconds for offline vehicles (was 30s)
    }
    
    return 60000; // Default 60 seconds (was 30s)
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  calculateRetryDelay(): number {
    if (this.retryCount === 0) return 0;
    return Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30 seconds
  }

  /**
   * Check if retry is needed and allowed
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
    return [...this.devices];
  }

  /**
   * Get current lastQueryTime for debugging
   */
  getLastQueryTime(): number {
    return this.lastQueryTime;
  }

  /**
   * Reset lastQueryTime to 0 for fresh start
   */
  resetQueryTime(): void {
    this.lastQueryTime = 0;
    console.log('GPS51UnifiedLiveDataService: Query time reset to 0');
  }

  /**
   * Get service status and diagnostics
   */
  getServiceStatus() {
    return {
      isAuthenticated: this.authState.isAuthenticated,
      username: this.authState.username,
      deviceCount: this.devices.length,
      lastQueryTime: this.lastQueryTime,
      retryCount: this.retryCount,
      movingVehicles: this.devices.filter(v => v.isMoving).length,
      stationaryVehicles: this.devices.filter(v => !v.isMoving && v.status !== 'offline').length,
      offlineVehicles: this.devices.filter(v => v.status === 'offline').length,
      clientDiagnostics: this.client.getDiagnostics()
    };
  }

  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    try {
      await this.client.logout();
    } catch (error) {
      console.warn('GPS51UnifiedLiveDataService: Logout error:', error);
    }

    this.authState = {
      isAuthenticated: false,
      token: null,
      username: null
    };
    this.devices = [];
    this.lastQueryTime = 0;
    this.retryCount = 0;
    
    // CRITICAL FIX: Clear username from localStorage
    localStorage.removeItem('gps51_username');
    
    // CRITICAL FIX: Notify simple auth sync of logout
    gps51SimpleAuthSync.notifyLogout();
    
    console.log('GPS51UnifiedLiveDataService: Logged out and reset');
  }

  /**
   * Clear all caches (emergency use)
   */
  clearCaches(): void {
    this.client.clearAllCaches();
    console.log('GPS51UnifiedLiveDataService: All caches cleared');
  }
}

// Export singleton instance
export const gps51UnifiedLiveDataService = GPS51UnifiedLiveDataService.getInstance();