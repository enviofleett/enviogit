import { gps51MasterPollingService } from './GPS51MasterPollingService';
import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from './types';

export interface EnhancedLiveDataState {
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastUpdate: Date | null;
}

export interface LiveDataManagerStatus {
  isActive: boolean;
  isAuthenticated: boolean;
  connectionHealth: 'good' | 'degraded' | 'poor';
  lastUpdate: Date | null;
  deviceCount: number;
  positionCount: number;
  databaseSyncEnabled: boolean;
  lastDatabaseSync: Date | null;
  errors: string[];
}

export class GPS51LiveDataManager {
  private static instance: GPS51LiveDataManager;
  private activeSession: string | null = null;
  private currentState: EnhancedLiveDataState = {
    devices: [],
    positions: [],
    lastUpdate: null
  };

  static getInstance(): GPS51LiveDataManager {
    if (!GPS51LiveDataManager.instance) {
      GPS51LiveDataManager.instance = new GPS51LiveDataManager();
    }
    return GPS51LiveDataManager.instance;
  }

  /**
   * Initialize the live data system using the master polling service
   */
  async initializeLiveDataSystem(): Promise<boolean> {
    try {
      console.log('GPS51LiveDataManager: Initializing coordinated live data system...');

      // Test basic connectivity through coordinator
      try {
        await gps51CoordinatorClient.getCoordinatorStatus();
        console.log('GPS51LiveDataManager: Coordinator connectivity confirmed');
      } catch (error) {
        console.warn('GPS51LiveDataManager: Coordinator not available:', error);
        return false;
      }

      // Start polling if not already active
      if (!this.activeSession) {
        console.log('GPS51LiveDataManager: Starting coordinated polling...');
        this.startEnhancedPolling();
      }

      console.log('GPS51LiveDataManager: Coordinated live data system initialized successfully');
      return true;
    } catch (error) {
      console.error('GPS51LiveDataManager: Failed to initialize coordinated live data system:', error);
      return false;
    }
  }

  /**
   * Start enhanced polling using the master polling service
   */
  startEnhancedPolling(callback?: (data: EnhancedLiveDataState) => void): void {
    if (this.activeSession) {
      console.log('GPS51LiveDataManager: Polling session already active');
      return;
    }

    console.log('GPS51LiveDataManager: Starting coordinated enhanced polling...');

    // Create a unique session ID
    this.activeSession = `live-data-manager-${Date.now()}`;

    // Register with master polling service
    gps51MasterPollingService.registerSession(
      this.activeSession,
      [], // Will be updated with actual device IDs
      30000, // 30 second interval for general live data
      (data) => {
        console.log('GPS51LiveDataManager: Live data update received:', {
          devices: data.devices.length,
          positions: data.positions.length,
          lastQueryTime: data.lastQueryTime
        });

        // Update internal state
        this.currentState = {
          devices: data.devices,
          positions: data.positions,
          lastUpdate: new Date()
        };

        // Dispatch custom event for dashboard updates
        window.dispatchEvent(new CustomEvent('gps51-live-data-update', { 
          detail: this.currentState
        }));

        // Call callback if provided
        if (callback) {
          callback(this.currentState);
        }
      },
      'normal'
    );

    // Get initial device list and update session
    this.updateDeviceList();

    console.log('GPS51LiveDataManager: Coordinated enhanced polling started');
  }

  /**
   * Update device list for the polling session
   */
  private async updateDeviceList(): Promise<void> {
    if (!this.activeSession) return;

    try {
      const devices = await gps51CoordinatorClient.getDeviceList();
      const deviceIds = devices.map(d => d.deviceid);
      
      gps51MasterPollingService.updateSession(this.activeSession, {
        deviceIds
      });

      console.log('GPS51LiveDataManager: Updated session with', deviceIds.length, 'devices');
    } catch (error) {
      console.error('GPS51LiveDataManager: Failed to update device list:', error);
    }
  }

  /**
   * Stop live data polling
   */
  stopPolling(): void {
    if (!this.activeSession) {
      return;
    }

    console.log('GPS51LiveDataManager: Stopping coordinated live data polling...');
    gps51MasterPollingService.unregisterSession(this.activeSession);
    this.activeSession = null;
    console.log('GPS51LiveDataManager: Coordinated live data polling stopped');
  }

  /**
   * Get current live data status
   */
  getStatus(): LiveDataManagerStatus {
    const masterStatus = gps51MasterPollingService.getStatus();

    return {
      isActive: !!this.activeSession && masterStatus.isPolling,
      isAuthenticated: true, // Authenticated through coordinator
      connectionHealth: 'good', // Simplified for now
      lastUpdate: this.currentState.lastUpdate,
      deviceCount: this.currentState.devices.length,
      positionCount: this.currentState.positions.length,
      databaseSyncEnabled: false, // Simplified for now
      lastDatabaseSync: null,
      errors: []
    };
  }

  /**
   * Get current live data state
   */
  getCurrentState(): EnhancedLiveDataState {
    return this.currentState;
  }

  /**
   * Force a manual sync through the coordinator
   */
  async forceLiveDataSync(): Promise<EnhancedLiveDataState> {
    try {
      console.log('GPS51LiveDataManager: Manual coordinated sync requested...');
      
      if (!this.activeSession) {
        throw new Error('No active polling session');
      }

      // Force immediate poll for this session
      await gps51MasterPollingService.forcePoll(this.activeSession);
      
      console.log('GPS51LiveDataManager: Manual coordinated sync completed:', {
        devices: this.currentState.devices.length,
        positions: this.currentState.positions.length
      });

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('gps51-live-data-update', { 
        detail: this.currentState 
      }));

      return this.currentState;
    } catch (error) {
      console.error('GPS51LiveDataManager: Manual coordinated sync failed:', error);
      throw error;
    }
  }

  /**
   * Reset the entire live data system
   */
  async resetSystem(): Promise<void> {
    console.log('GPS51LiveDataManager: Resetting coordinated live data system...');
    
    this.stopPolling();
    this.currentState = {
      devices: [],
      positions: [],
      lastUpdate: null
    };
    
    console.log('GPS51LiveDataManager: Coordinated system reset completed');
  }

  /**
   * Get comprehensive diagnostic information
   */
  getDiagnosticInfo() {
    return {
      manager: {
        isActive: !!this.activeSession,
        sessionId: this.activeSession,
        currentDevices: this.currentState.devices.length,
        currentPositions: this.currentState.positions.length
      },
      masterPolling: gps51MasterPollingService.getStatus(),
      coordinator: {
        available: true
      }
    };
  }
}

export const gps51LiveDataManager = GPS51LiveDataManager.getInstance();