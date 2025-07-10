/**
 * GPS51 Production Service - Updated to use Unified Authentication
 * Now leverages the GPS51UnifiedAuthManager for all authentication operations
 */

import { gps51UnifiedAuthManager, GPS51UnifiedAuthState } from './unified/GPS51UnifiedAuthManager';
import { gps51SimpleAuthSync } from './GPS51SimpleAuthSync';
import { gps51PerformanceOptimizer } from './GPS51PerformanceOptimizer';
import { gps51UserTypeManager, EnvioUserRole, GPS51UserProfile } from './GPS51UserTypeManager';
import { gps51IntelligentPolling, VehicleState } from './GPS51IntelligentPolling';
import { gps51GroupManager, FleetHierarchy } from './GPS51GroupManager';

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
  groupid?: string;
  groupname?: string;
  vehicleState?: VehicleState;
  pollingPriority?: number;
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

// Re-export the unified auth state interface
export type GPS51AuthState = GPS51UnifiedAuthState;

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
  private vehicles: GPS51Vehicle[] = [];
  private lastQueryTime: number = 0;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private userRole: EnvioUserRole = EnvioUserRole.INDIVIDUAL_OWNER;
  
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
   * Authenticate using the unified auth manager
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    try {
      console.log('GPS51ProductionService: Starting authentication for', username, {
        apiUrl: this.apiUrl,
        timestamp: new Date().toISOString()
      });

      const result = await gps51UnifiedAuthManager.authenticate(username, password, this.apiUrl);
      
      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      // Get the updated auth state
      const authState = gps51UnifiedAuthManager.getAuthState();
      
      // Initialize user profile and fleet hierarchy
      if (authState.isAuthenticated) {
        await this.initializeUserProfile(result.user);
        
        // Notify simple auth sync
        gps51SimpleAuthSync.notifyAuthSuccess(username);
      }

      console.log('GPS51ProductionService: Authentication completed successfully:', {
        username,
        totalProcessingTime: result.responseTime,
        hasToken: !!authState.token,
        tokenLength: authState.token?.length || 0
      });

      return authState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      console.error('GPS51ProductionService: Authentication failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get current authentication state from unified manager
   */
  getAuthState(): GPS51AuthState {
    return gps51UnifiedAuthManager.getAuthState();
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return gps51UnifiedAuthManager.isAuthenticated();
  }

  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    console.log('GPS51ProductionService: Logging out');
    
    // Clear unified auth manager
    gps51UnifiedAuthManager.logout();
    
    // Clear local state
    this.vehicles = [];
    this.lastQueryTime = 0;
    this.retryCount = 0;
    
    // Notify simple auth sync
    gps51SimpleAuthSync.notifyLogout();
    
    console.log('GPS51ProductionService: Logout completed');
  }

  /**
   * Fetch vehicles using authenticated token
   */
  async fetchVehicles(): Promise<GPS51Vehicle[]> {
    try {
      console.log('GPS51ProductionService: Fetching vehicles...');
      
      const token = await gps51UnifiedAuthManager.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      const authState = gps51UnifiedAuthManager.getAuthState();
      if (!authState.username) {
        throw new Error('No username available for vehicle fetch');
      }

      // Call Edge Function for vehicles
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: response, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'querymonitorlist',
          username: authState.username,
          token,
          apiUrl: this.apiUrl
        }
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to fetch vehicles');
      }

      // Process vehicles from groups and devices
      const vehicles: GPS51Vehicle[] = [];
      const groups = response.groups || [];
      const devices = response.devices || [];

      // Process devices and assign group information
      devices.forEach((device: any) => {
        const group = groups.find((g: any) => g.groupid === device.groupid);
        
        const vehicle: GPS51Vehicle = {
          deviceid: device.deviceid,
          devicename: device.devicename || device.deviceid,
          simnum: device.simnum || '',
          lastactivetime: device.lastactivetime || new Date().toISOString(),
          isMoving: false,
          speed: 0,
          lastUpdate: new Date(),
          status: 'offline',
          devicetype: device.devicetype,
          overduetime: device.overduetime,
          remark: device.remark,
          groupid: device.groupid,
          groupname: group?.groupname || 'Default Group'
        };

        vehicles.push(vehicle);
      });

      this.vehicles = vehicles;
      
      console.log('GPS51ProductionService: Vehicles fetched successfully:', {
        vehicleCount: vehicles.length,
        groupCount: groups.length
      });

      return vehicles;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vehicles';
      console.error('GPS51ProductionService: Vehicle fetch failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Fetch positions for devices
   */
  async fetchPositions(deviceIds?: string[]): Promise<GPS51Position[]> {
    try {
      console.log('GPS51ProductionService: Fetching positions for devices:', {
        deviceCount: deviceIds?.length || 'all',
        lastQueryTime: this.lastQueryTime
      });

      const token = await gps51UnifiedAuthManager.getValidToken();
      if (!token) {
        throw new Error('No valid authentication token available');
      }

      // Use all vehicle IDs if none specified
      const targetDeviceIds = deviceIds || this.vehicles.map(v => v.deviceid);
      
      if (targetDeviceIds.length === 0) {
        console.log('GPS51ProductionService: No devices to fetch positions for');
        return [];
      }

      // Call Edge Function for positions
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: response, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'lastposition',
          deviceids: targetDeviceIds, // Pass as array
          lastquerypositiontime: this.lastQueryTime || undefined,
          token,
          apiUrl: this.apiUrl
        }
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to fetch positions');
      }

      const positions: GPS51Position[] = response.records || [];
      
      // Update last query time if provided
      if (response.lastquerypositiontime) {
        this.lastQueryTime = response.lastquerypositiontime;
      }

      // Update vehicle positions and states
      this.updateVehicleStates(positions);

      console.log('GPS51ProductionService: Position fetch completed successfully:', {
        positionsReceived: positions.length,
        newLastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        vehiclesUpdated: this.vehicles.length
      });

      return positions;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch positions';
      console.error('GPS51ProductionService: Position fetch failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Get live data (vehicles + positions)
   */
  async getLiveData(deviceIds?: string[]): Promise<LiveDataResult> {
    try {
      // Ensure we have vehicles first
      if (this.vehicles.length === 0) {
        await this.fetchVehicles();
      }

      // Fetch positions
      const positions = await this.fetchPositions(deviceIds);

      return {
        vehicles: [...this.vehicles],
        positions,
        lastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        isSuccess: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get live data';
      
      return {
        vehicles: [...this.vehicles],
        positions: [],
        lastQueryTime: this.lastQueryTime,
        isEmpty: true,
        isSuccess: false,
        error: errorMessage
      };
    }
  }

  /**
   * Initialize user profile from authentication response
   */
  private async initializeUserProfile(user: any): Promise<void> {
    try {
      if (user) {
        const userProfile = {
          username: user.username,
          usertype: user.usertype || 11,
          showname: user.showname || user.username,
          email: user.email || '',
          envioRole: EnvioUserRole.INDIVIDUAL_OWNER,
          permissions: { canManageUsers: false, canManageDevices: false, canViewReports: true, canConfigureAlerts: false, deviceAccessLevel: 'own' as const }
        };

        this.userRole = userProfile.envioRole;
        
        console.log('GPS51ProductionService: User profile initialized:', {
          username: userProfile.username,
          usertype: userProfile.usertype,
          envioRole: userProfile.envioRole,
          permissions: userProfile.permissions
        });
      }
    } catch (error) {
      console.error('GPS51ProductionService: Failed to initialize user profile:', error);
    }
  }

  /**
   * Update vehicle states with position data
   */
  private updateVehicleStates(positions: GPS51Position[]): void {
    positions.forEach(position => {
      const vehicle = this.vehicles.find(v => v.deviceid === position.deviceid);
      if (vehicle) {
        vehicle.position = position;
        vehicle.isMoving = position.moving === 1;
        vehicle.speed = position.speed || 0;
        vehicle.lastUpdate = new Date();
        vehicle.status = position.moving === 1 ? 'moving' : 'stopped';
      }
    });
  }

  /**
   * Get current vehicles
   */
  getVehicles(): GPS51Vehicle[] {
    return [...this.vehicles];
  }

  /**
   * Get last query time
   */
  getLastQueryTime(): number {
    return this.lastQueryTime;
  }

  // Compatibility methods for existing components
  
  /**
   * Alias for fetchVehicles for backward compatibility
   */
  async fetchUserDevices(): Promise<GPS51Vehicle[]> {
    return this.fetchVehicles();
  }

  /**
   * Alias for getVehicles for backward compatibility
   */
  getDevices(): GPS51Vehicle[] {
    return this.getVehicles();
  }

  /**
   * Alias for fetchPositions for backward compatibility
   */
  async fetchLivePositions(deviceIds?: string[]): Promise<LiveDataResult> {
    try {
      const positions = await this.fetchPositions(deviceIds);
      return {
        vehicles: [...this.vehicles],
        positions,
        lastQueryTime: this.lastQueryTime,
        isEmpty: positions.length === 0,
        isSuccess: true
      };
    } catch (error) {
      return {
        vehicles: [...this.vehicles],
        positions: [],
        lastQueryTime: this.lastQueryTime,
        isEmpty: true,
        isSuccess: false,
        error: error instanceof Error ? error.message : 'Failed to fetch positions'
      };
    }
  }

  /**
   * Get service status for monitoring components
   */
  getServiceStatus(): any {
    const authState = this.getAuthState();
    return {
      isAuthenticated: authState.isAuthenticated,
      hasToken: !!authState.token,
      username: authState.username,
      vehicleCount: this.vehicles.length,
      lastQueryTime: this.lastQueryTime,
      error: authState.error
    };
  }

  /**
   * Get fleet hierarchy (simplified version)
   */
  getFleetHierarchy(): FleetHierarchy | null {
    // Basic hierarchy based on current vehicles
    const groups = new Map();
    
    this.vehicles.forEach(vehicle => {
      const groupId = vehicle.groupid || 'default';
      const groupName = vehicle.groupname || 'Default Group';
      
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupid: groupId,
          groupname: groupName,
          devices: []
        });
      }
      
      groups.get(groupId).devices.push(vehicle);
    });

    return {
      rootGroups: Array.from(groups.values()),
      userAccessibleGroups: Array.from(groups.values()),
      userDevices: this.vehicles.map(v => ({
        deviceid: v.deviceid,
        devicename: v.devicename,
        simnum: v.simnum,
        devicetype: v.devicetype,
        lastactivetime: v.lastactivetime,
        overduetime: v.overduetime,
        remark: v.remark
      })),
      totalDevices: this.vehicles.length
    };
  }

  /**
   * Refresh all vehicle states
   */
  async refreshAllVehicleStates(): Promise<void> {
    try {
      await this.fetchVehicles();
      await this.fetchPositions();
    } catch (error) {
      console.error('GPS51ProductionService: Failed to refresh vehicle states:', error);
    }
  }

  /**
   * Reset query time for position polling
   */
  resetQueryTime(): void {
    this.lastQueryTime = 0;
    console.log('GPS51ProductionService: Query time reset for full refresh');
  }

  /**
   * Calculate polling interval based on conditions
   */
  calculatePollingInterval(): number {
    return this.minRequestInterval;
  }

  /**
   * Calculate retry delay for failed requests
   */
  calculateRetryDelay(attempt?: number): number {
    return Math.min(1000 * Math.pow(2, attempt || 0), 30000);
  }

  /**
   * Check if should retry based on error type
   */
  shouldRetry(error?: any, attempt?: number): boolean {
    if (!error || !attempt) return false;
    return attempt < this.maxRetries && !error.message?.includes('authentication');
  }
}

// Export singleton instance
export const gps51ProductionService = GPS51ProductionService.getInstance();