/**
 * GPS51 EMERGENCY MANAGER - SINGLE CONSOLIDATED CLIENT
 * Replaces all GPS51 clients with one emergency-optimized implementation
 */

import { EmergencyGPS51Client } from './emergency/EmergencyGPS51Client';
import { GPS51Device, GPS51Position } from './types';

interface GPS51Credentials {
  username: string;
  password: string;
  apiUrl?: string;
  from?: string;
  type?: string;
}

interface GPS51AuthState {
  isAuthenticated: boolean;
  username: string | null;
  lastLoginTime: number | null;
}

export class GPS51EmergencyManager {
  private static instance: GPS51EmergencyManager;
  private client: EmergencyGPS51Client;
  private authState: GPS51AuthState = {
    isAuthenticated: false,
    username: null,
    lastLoginTime: null
  };

  private constructor() {
    this.client = new EmergencyGPS51Client('https://api.gps51.com/openapi');
    this.loadAuthState();
    this.initializeFromExistingAuth();
  }

  static getInstance(): GPS51EmergencyManager {
    if (!GPS51EmergencyManager.instance) {
      GPS51EmergencyManager.instance = new GPS51EmergencyManager();
    }
    return GPS51EmergencyManager.instance;
  }

  private loadAuthState(): void {
    try {
      const saved = localStorage.getItem('gps51_auth_state');
      if (saved) {
        this.authState = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load GPS51 auth state:', error);
    }
  }

  private saveAuthState(): void {
    try {
      localStorage.setItem('gps51_auth_state', JSON.stringify(this.authState));
    } catch (error) {
      console.warn('Failed to save GPS51 auth state:', error);
    }
  }

  async authenticate(credentials: GPS51Credentials): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚨 GPS51EmergencyManager: Authenticating with emergency client');
      
      // Auto-hash password if needed using GPS51Utils
      const { GPS51Utils } = await import('./GPS51Utils');
      const hashedPassword = await GPS51Utils.ensureMD5Hash(credentials.password);
      
      const token = await this.client.login(credentials.username, hashedPassword);
      
      this.authState = {
        isAuthenticated: true,
        username: credentials.username,
        lastLoginTime: Date.now()
      };
      
      this.saveAuthState();
      
      // Cache credentials for device list calls
      localStorage.setItem('gps51_credentials', JSON.stringify({
        ...credentials,
        password: hashedPassword // Store hashed password
      }));
      
      // Emit authentication success event for other components
      window.dispatchEvent(new CustomEvent('gps51-emergency-auth-success', {
        detail: { username: credentials.username, timestamp: Date.now() }
      }));
      
      console.log('🟢 GPS51EmergencyManager: Authentication successful');
      return { success: true };
      
    } catch (error) {
      console.error('🔴 GPS51EmergencyManager: Authentication failed:', error);
      this.authState.isAuthenticated = false;
      this.saveAuthState();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async getDeviceList(forceRefresh = false): Promise<GPS51Device[]> {
    if (!this.authState.isAuthenticated || !this.authState.username) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      console.log('🚨 GPS51EmergencyManager: Fetching device list with emergency caching');
      
      const response = await this.client.getDeviceList(this.authState.username, forceRefresh);
      
      // Extract devices from groups structure
      let devices: GPS51Device[] = [];
      if (response.groups && Array.isArray(response.groups)) {
        response.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            devices = devices.concat(group.devices);
          }
        });
      }
      
      console.log(`🟢 GPS51EmergencyManager: Retrieved ${devices.length} devices`);
      return devices;
      
    } catch (error) {
      console.error('🔴 GPS51EmergencyManager: Device list failed:', error);
      throw error;
    }
  }

  async getRealtimePositions(
    deviceIds: string[],
    lastQueryTime = 0,
    forceRefresh = false
  ): Promise<{ positions: GPS51Position[]; lastQueryTime: number }> {
    if (!this.authState.isAuthenticated) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      console.log(`🚨 GPS51EmergencyManager: Fetching positions for ${deviceIds.length} devices`);
      
      const response = await this.client.getLastPosition(deviceIds, lastQueryTime, forceRefresh);
      
      // Extract positions from response
      const positions = response.records || [];
      const newLastQueryTime = response.lastquerypositiontime || Date.now();
      
      console.log(`🟢 GPS51EmergencyManager: Retrieved ${positions.length} positions`);
      
      return {
        positions,
        lastQueryTime: newLastQueryTime
      };
      
    } catch (error) {
      console.error('🔴 GPS51EmergencyManager: Position fetch failed:', error);
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  getUsername(): string | null {
    return this.authState.username;
  }

  logout(): void {
    console.log('🚨 GPS51EmergencyManager: Logging out');
    this.client.logout();
    this.authState = {
      isAuthenticated: false,
      username: null,
      lastLoginTime: null
    };
    this.saveAuthState();
    localStorage.removeItem('gps51_credentials');
  }

  getDiagnostics() {
    return {
      auth: this.authState,
      client: this.client.getDiagnostics(),
      emergencyMode: true,
      optimized: true
    };
  }

  // Emergency controls
  clearAllCaches(): void {
    console.log('🧹 GPS51EmergencyManager: Clearing all caches');
    this.client.clearAllCaches();
  }

  // Check if emergency stop is active
  isEmergencyStopActive(): boolean {
    try {
      const emergencyStatus = localStorage.getItem('gps51_emergency_status');
      if (emergencyStatus) {
        const status = JSON.parse(emergencyStatus);
        return status.active === true;
      }
    } catch (error) {
      console.warn('Failed to check emergency status:', error);
    }
    return false;
  }

  // Initialize from existing authentication if available
  private async initializeFromExistingAuth(): Promise<void> {
    try {
      // Check if we have saved credentials and attempt auto-authentication
      const savedCredentials = localStorage.getItem('gps51_credentials');
      if (savedCredentials && !this.authState.isAuthenticated) {
        const credentials = JSON.parse(savedCredentials);
        console.log('🔄 GPS51EmergencyManager: Found saved credentials, attempting auto-authentication');
        await this.authenticate(credentials);
      }

      // Listen for unified auth service events
      window.addEventListener('gps51-authentication-success', this.handleUnifiedAuthSuccess.bind(this));
      window.addEventListener('gps51-authentication-logout', this.handleUnifiedAuthLogout.bind(this));
    } catch (error) {
      console.warn('GPS51EmergencyManager: Failed to initialize from existing auth:', error);
    }
  }

  private handleUnifiedAuthSuccess(event: CustomEvent): void {
    const authData = event.detail;
    console.log('🔗 GPS51EmergencyManager: Received unified auth success event', authData);
    
    // Update our auth state based on unified service
    if (authData?.credentials) {
      this.authState = {
        isAuthenticated: true,
        username: authData.credentials.username,
        lastLoginTime: Date.now()
      };
      this.saveAuthState();
    }
  }

  private handleUnifiedAuthLogout(): void {
    console.log('🔗 GPS51EmergencyManager: Received unified auth logout event');
    this.logout();
  }
}

// Export singleton instance
export const gps51EmergencyManager = GPS51EmergencyManager.getInstance();