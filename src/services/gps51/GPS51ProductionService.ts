/**
 * GPS51 Production Service - Single Entry Point
 * Consolidates all GPS51 operations into one authoritative service
 * Eliminates redundancy and provides reliable, coordinated API access
 */

import { GPS51ConfigStorage } from './configStorage';
import { GPS51CredentialChecker } from './GPS51CredentialChecker';
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

export interface GPS51AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  userProfile?: GPS51UserProfile;
  fleetHierarchy?: FleetHierarchy;
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
   * Authenticate with GPS51 API
   * Single source of truth for authentication
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51ProductionService: Starting authentication for', username, {
        apiUrl: this.apiUrl,
        timestamp: new Date().toISOString()
      });
      
      // Enhanced credential validation
      if (!username || !password) {
        throw new Error('Username and password are required');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
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

        // Ensure password is MD5 hashed
        const { GPS51Utils } = await import('./GPS51Utils');
        const hashedPassword = await GPS51Utils.ensureMD5Hash(password);
        
        console.log('GPS51ProductionService: Calling Edge Function with validated credentials:', {
          username,
          hashedPasswordLength: hashedPassword.length,
          isPasswordMD5: /^[a-f0-9]{32}$/i.test(hashedPassword),
          apiUrl: this.apiUrl
        });

        // Call GPS51 login API through Edge Function
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data, error } = await supabase.functions.invoke('gps51-auth', {
          body: {
            action: 'login',
            username,
            password: hashedPassword,
            from: 'WEB',
            type: 'USER',
            apiUrl: this.apiUrl
          }
        });

        const processingTime = Date.now() - startTime;

        // Enhanced error handling with detailed logging
        if (error) {
          console.error('GPS51ProductionService: Edge Function invocation error:', {
            error: error.message,
            processingTime,
            username
          });
          throw new Error(`Edge Function error: ${error.message}`);
        }

        if (!data) {
          console.error('GPS51ProductionService: No response from Edge Function:', {
            processingTime,
            username
          });
          throw new Error('No response from authentication service');
        }

        console.log('GPS51ProductionService: Edge Function response received:', {
          success: data.success,
          hasToken: !!data.access_token,
          hasUser: !!data.user,
          gps51Status: data.gps51_status,
          requestId: data.request_id,
          processingTime
        });

        if (!data.success) {
          const errorMsg = data.error || 'Authentication failed - invalid response from server';
          console.error('GPS51ProductionService: Authentication failed:', {
            error: errorMsg,
            errorCode: data.error_code,
            requestId: data.request_id,
            processingTime
          });
          throw new Error(errorMsg);
        }

        return data;
      });

      // Update authentication state with enhanced logging
      this.authState = {
        isAuthenticated: true,
        token: result.access_token || result.token,
        username
      };

      // Store credentials for session persistence
      localStorage.setItem('gps51_username', username);
      localStorage.setItem('gps51_last_auth_success', new Date().toISOString());
      
      // Initialize user profile and polling
      await this.initializeUserProfile(username, result);
      
      // Notify auth sync
      gps51SimpleAuthSync.notifyAuthSuccess(username);

      const totalTime = Date.now() - startTime;
      console.log('GPS51ProductionService: Authentication completed successfully:', {
        username,
        totalProcessingTime: totalTime,
        hasToken: !!this.authState.token,
        tokenLength: this.authState.token?.length
      });
      
      return this.authState;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      this.authState = {
        isAuthenticated: false,
        token: null,
        username: null,
        error: errorMessage
      };

      // Store failed attempt for analysis
      localStorage.setItem('gps51_last_auth_error', JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        username,
        processingTime: totalTime
      }));

      console.error('GPS51ProductionService: Authentication failed:', {
        error: errorMessage,
        username,
        hasCredentials: !!username,
        apiUrl: this.apiUrl,
        totalProcessingTime: totalTime,
        retryCount: this.retryCount
      });
      
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
          token: this.authState.token,
          apiUrl: this.apiUrl
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

      // Process groups and build fleet hierarchy
      const fleetHierarchy = gps51GroupManager.processGroupsResponse(data.groups || [], this.userRole);
      this.authState.fleetHierarchy = fleetHierarchy;

      // Transform to GPS51Vehicle format with group information
      this.vehicles = fleetHierarchy.userDevices.map(device => {
        // Initialize intelligent polling for each device
        gps51IntelligentPolling.updateVehicleProfile(device.deviceid);
        
        return {
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
          status: 'unknown',
          vehicleState: VehicleState.OFFLINE,
          pollingPriority: 4
        };
      });

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
      // Use intelligent polling to determine which devices to query
      const readyDeviceIds = deviceIds || gps51IntelligentPolling.getVehiclesReadyForPolling();
      const targetDeviceIds = readyDeviceIds.length > 0 ? readyDeviceIds : this.vehicles.map(d => d.deviceid);
      
      if (targetDeviceIds.length === 0) {
        return {
          vehicles: [],
          positions: [],
          lastQueryTime: this.lastQueryTime,
          isEmpty: true,
          isSuccess: true
        };
      }

      console.log('GPS51ProductionService: Intelligent polling selected', targetDeviceIds.length, 'devices');
      console.log('GPS51ProductionService: Using lastquerypositiontime:', this.lastQueryTime);

      await this.enforceRateLimit();

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'lastposition',
          deviceids: targetDeviceIds,
          lastquerypositiontime: this.lastQueryTime || undefined,
          token: this.authState.token,
          apiUrl: this.apiUrl
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

      // Update vehicles with position data and intelligent polling
      const updatedVehicles = this.vehicles.map(vehicle => {
        const position = positions.find(p => p.deviceid === vehicle.deviceid);
        
        // Update intelligent polling profile
        const pollingProfile = gps51IntelligentPolling.updateVehicleProfile(vehicle.deviceid, position);
        
        // Mark as polled if it was in the target list
        if (targetDeviceIds.includes(vehicle.deviceid)) {
          gps51IntelligentPolling.markVehiclePolled(vehicle.deviceid);
        }
        
        return {
          ...vehicle,
          position,
          isMoving: position ? position.moving === 1 : false,
          speed: position ? position.speed : 0,
          lastUpdate: new Date(),
          status: position ? position.strstatusen : 'offline',
          vehicleState: pollingProfile.state,
          pollingPriority: pollingProfile.priority
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
   * Calculate smart polling interval using intelligent polling
   */
  calculatePollingInterval(): number {
    return gps51IntelligentPolling.calculateGlobalPollingInterval();
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
   * Get service status with intelligent polling data
   */
  getServiceStatus() {
    const pollingStats = gps51IntelligentPolling.getPollingStatistics();
    
    return {
      isAuthenticated: this.authState.isAuthenticated,
      username: this.authState.username,
      userRole: this.userRole,
      deviceCount: this.vehicles.length,
      lastQueryTime: this.lastQueryTime,
      retryCount: this.retryCount,
      movingVehicles: this.vehicles.filter(v => v.isMoving).length,
      stationaryVehicles: this.vehicles.filter(v => !v.isMoving && v.status !== 'offline').length,
      offlineVehicles: this.vehicles.filter(v => v.status === 'offline').length,
      minRequestInterval: this.minRequestInterval,
      timeSinceLastRequest: Date.now() - this.lastRequestTime,
      intelligentPolling: pollingStats,
      fleetHierarchy: this.authState.fleetHierarchy
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
    
    // Clear intelligent polling and group management
    gps51IntelligentPolling.clearAllProfiles();
    gps51GroupManager.clearHierarchy();
    
    localStorage.removeItem('gps51_username');
    gps51SimpleAuthSync.notifyLogout();
    
    console.log('GPS51ProductionService: Logged out and reset');
  }

  /**
   * Initialize user profile after authentication
   */
  private async initializeUserProfile(username: string, authData: any): Promise<void> {
    try {
      // Determine user role from GPS51 usertype or default
      const gps51UserType = authData.user?.usertype || 11; // Default to END_USER
      this.userRole = gps51UserTypeManager.getEnvioRole(gps51UserType);
      
      // Create user profile
      const userProfile: GPS51UserProfile = {
        username,
        usertype: gps51UserType,
        envioRole: this.userRole,
        companyname: authData.user?.companyname || '',
        showname: authData.user?.showname || username.split('@')[0],
        email: username,
        permissions: gps51UserTypeManager.getUserPermissions(this.userRole)
      };
      
      this.authState.userProfile = userProfile;
      
      console.log('GPS51ProductionService: User profile initialized:', {
        username,
        usertype: gps51UserType,
        envioRole: this.userRole,
        permissions: userProfile.permissions
      });
      
    } catch (error) {
      console.warn('GPS51ProductionService: Failed to initialize user profile:', error);
      // Continue with default permissions
      this.userRole = EnvioUserRole.INDIVIDUAL_OWNER;
    }
  }

  /**
   * Register new user with GPS51
   */
  async registerUser(
    username: string, 
    password: string, 
    envioRole: EnvioUserRole,
    additionalData?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const registrationPayload = gps51UserTypeManager.createUserRegistrationPayload(
        username, 
        password, 
        envioRole, 
        additionalData
      );

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'adduser',
          ...registrationPayload
        }
      });

      if (error) {
        throw new Error(`User registration failed: ${error.message}`);
      }

      if (data?.status !== 0) {
        throw new Error(data?.message || 'User registration failed');
      }

      console.log('GPS51ProductionService: User registration successful:', username);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      console.error('GPS51ProductionService: User registration failed:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get fleet hierarchy
   */
  getFleetHierarchy(): FleetHierarchy | undefined {
    return this.authState.fleetHierarchy;
  }

  /**
   * Get devices by group
   */
  getDevicesByGroup(groupId: string): GPS51Vehicle[] {
    const groupDevices = gps51GroupManager.getDevicesByGroup(groupId);
    return this.vehicles.filter(vehicle => 
      groupDevices.some(device => device.deviceid === vehicle.deviceid)
    );
  }

  /**
   * Get vehicles ready for polling
   */
  getVehiclesReadyForPolling(): GPS51Vehicle[] {
    const readyDeviceIds = gps51IntelligentPolling.getVehiclesReadyForPolling();
    return this.vehicles.filter(vehicle => readyDeviceIds.includes(vehicle.deviceid));
  }

  /**
   * Force refresh all vehicle states
   */
  async refreshAllVehicleStates(): Promise<void> {
    gps51IntelligentPolling.clearAllProfiles();
    
    // Re-initialize polling profiles for all vehicles
    for (const vehicle of this.vehicles) {
      gps51IntelligentPolling.updateVehicleProfile(vehicle.deviceid, vehicle.position);
    }
    
    console.log('GPS51ProductionService: All vehicle states refreshed');
  }
}

// Export singleton instance
export const gps51ProductionService = GPS51ProductionService.getInstance();