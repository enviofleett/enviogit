import { GPS51Device, GPS51Position } from './GPS51Types';

export interface EnhancedLiveDataState {
  lastQueryPositionTime: number;
  devices: GPS51Device[];
  positions: GPS51Position[];
  lastUpdate: Date;
  deviceSyncTimes: Map<string, number>; // Track last sync time per device
  deviceActivityStatus: Map<string, 'active' | 'idle' | 'inactive'>; // Track device activity
  syncMetrics: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSuccessTime: Date | null;
    averageResponseTime: number;
  };
}

export class GPS51EnhancedStateManager {
  private static readonly STORAGE_KEY = 'gps51_enhanced_state';
  private static readonly DEVICE_ACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  private static readonly DEVICE_INACTIVE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  
  private state: EnhancedLiveDataState;

  constructor() {
    this.state = this.loadPersistedState() || this.getInitialState();
    console.log('GPS51EnhancedStateManager: Initialized with', {
      hasPersistedState: !!this.loadPersistedState(),
      lastQueryTime: this.state.lastQueryPositionTime,
      devicesCount: this.state.devices.length
    });
  }

  private getInitialState(): EnhancedLiveDataState {
    return {
      lastQueryPositionTime: 0,
      devices: [],
      positions: [],
      lastUpdate: new Date(),
      deviceSyncTimes: new Map(),
      deviceActivityStatus: new Map(),
      syncMetrics: {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSuccessTime: null,
        averageResponseTime: 0
      }
    };
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): EnhancedLiveDataState | null {
    try {
      const stored = localStorage.getItem(GPS51EnhancedStateManager.STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        lastUpdate: new Date(parsed.lastUpdate),
        deviceSyncTimes: new Map(parsed.deviceSyncTimes || []),
        deviceActivityStatus: new Map(parsed.deviceActivityStatus || []),
        syncMetrics: {
          ...parsed.syncMetrics,
          lastSuccessTime: parsed.syncMetrics.lastSuccessTime ? new Date(parsed.syncMetrics.lastSuccessTime) : null
        }
      };
    } catch (error) {
      console.warn('GPS51EnhancedStateManager: Failed to load persisted state:', error);
      return null;
    }
  }

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    try {
      const toStore = {
        ...this.state,
        deviceSyncTimes: Array.from(this.state.deviceSyncTimes.entries()),
        deviceActivityStatus: Array.from(this.state.deviceActivityStatus.entries())
      };
      localStorage.setItem(GPS51EnhancedStateManager.STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.warn('GPS51EnhancedStateManager: Failed to persist state:', error);
    }
  }

  /**
   * Update state with enhanced tracking and persistence
   */
  updateState(
    devices: GPS51Device[], 
    positions: GPS51Position[], 
    serverLastQueryTime: number,
    responseTimeMs: number = 0
  ): void {
    const now = Date.now();
    const previousTime = this.state.lastQueryPositionTime;

    // Update device sync times and activity status
    positions.forEach(position => {
      this.state.deviceSyncTimes.set(position.deviceid, now);
      
      // Determine activity status based on position timestamp and movement
      const positionAge = now - new Date(position.updatetime).getTime();
      if (positionAge < GPS51EnhancedStateManager.DEVICE_ACTIVITY_THRESHOLD && position.moving === 1) {
        this.state.deviceActivityStatus.set(position.deviceid, 'active');
      } else if (positionAge < GPS51EnhancedStateManager.DEVICE_INACTIVE_THRESHOLD) {
        this.state.deviceActivityStatus.set(position.deviceid, 'idle');
      } else {
        this.state.deviceActivityStatus.set(position.deviceid, 'inactive');
      }
    });

    // Update sync metrics
    this.state.syncMetrics.totalSyncs++;
    this.state.syncMetrics.successfulSyncs++;
    this.state.syncMetrics.lastSuccessTime = new Date();
    
    // Update rolling average response time
    const currentAvg = this.state.syncMetrics.averageResponseTime;
    const totalSyncs = this.state.syncMetrics.successfulSyncs;
    this.state.syncMetrics.averageResponseTime = 
      ((currentAvg * (totalSyncs - 1)) + responseTimeMs) / totalSyncs;

    // Update main state
    this.state = {
      ...this.state,
      lastQueryPositionTime: serverLastQueryTime,
      devices,
      positions,
      lastUpdate: new Date()
    };

    // Persist to localStorage
    this.persistState();

    console.log('GPS51EnhancedStateManager: State updated with persistence', {
      devicesCount: devices.length,
      positionsCount: positions.length,
      previousServerTime: previousTime,
      newServerTime: serverLastQueryTime,
      activeDevices: this.getActiveDevicesCount(),
      idleDevices: this.getIdleDevicesCount(),
      inactiveDevices: this.getInactiveDevicesCount(),
      avgResponseTime: Math.round(this.state.syncMetrics.averageResponseTime),
      totalSyncs: this.state.syncMetrics.totalSyncs
    });
  }

  /**
   * Record failed sync for metrics
   */
  recordFailedSync(): void {
    this.state.syncMetrics.totalSyncs++;
    this.state.syncMetrics.failedSyncs++;
    this.persistState();
  }

  /**
   * Get current state
   */
  getCurrentState(): EnhancedLiveDataState {
    return { 
      ...this.state,
      deviceSyncTimes: new Map(this.state.deviceSyncTimes),
      deviceActivityStatus: new Map(this.state.deviceActivityStatus)
    };
  }

  /**
   * Get the server timestamp for next API call with persistence
   */
  getLastQueryTime(): number {
    return this.state.lastQueryPositionTime;
  }

  /**
   * Get device activity status
   */
  getDeviceActivityStatus(deviceId: string): 'active' | 'idle' | 'inactive' | 'unknown' {
    return this.state.deviceActivityStatus.get(deviceId) || 'unknown';
  }

  /**
   * Get devices by activity status
   */
  getDevicesByActivity(status: 'active' | 'idle' | 'inactive'): GPS51Device[] {
    return this.state.devices.filter(device => 
      this.state.deviceActivityStatus.get(device.deviceid) === status
    );
  }

  /**
   * Get count of devices by activity status
   */
  getActiveDevicesCount(): number {
    return Array.from(this.state.deviceActivityStatus.values())
      .filter(status => status === 'active').length;
  }

  getIdleDevicesCount(): number {
    return Array.from(this.state.deviceActivityStatus.values())
      .filter(status => status === 'idle').length;
  }

  getInactiveDevicesCount(): number {
    return Array.from(this.state.deviceActivityStatus.values())
      .filter(status => status === 'inactive').length;
  }

  /**
   * Get devices that need more frequent polling (active devices)
   */
  getHighPriorityDevices(): string[] {
    return this.getDevicesByActivity('active').map(device => device.deviceid);
  }

  /**
   * Get devices that can be polled less frequently
   */
  getLowPriorityDevices(): string[] {
    return [
      ...this.getDevicesByActivity('idle'),
      ...this.getDevicesByActivity('inactive')
    ].map(device => device.deviceid);
  }

  /**
   * Get recommended polling interval based on fleet activity
   */
  getRecommendedPollingInterval(): number {
    const activeCount = this.getActiveDevicesCount();
    const totalCount = this.state.devices.length;
    
    if (totalCount === 0) return 30000; // 30 seconds default
    
    const activityRatio = activeCount / totalCount;
    
    // More active devices = faster polling
    if (activityRatio > 0.5) return 10000; // 10 seconds for high activity
    if (activityRatio > 0.2) return 15000; // 15 seconds for medium activity
    return 30000; // 30 seconds for low activity
  }

  /**
   * Get sync performance metrics
   */
  getSyncMetrics() {
    const { syncMetrics } = this.state;
    return {
      ...syncMetrics,
      successRate: syncMetrics.totalSyncs > 0 ? 
        (syncMetrics.successfulSyncs / syncMetrics.totalSyncs) * 100 : 0,
      failureRate: syncMetrics.totalSyncs > 0 ? 
        (syncMetrics.failedSyncs / syncMetrics.totalSyncs) * 100 : 0
    };
  }

  /**
   * Clear all state and persistent storage
   */
  clearState(): void {
    this.state = this.getInitialState();
    localStorage.removeItem(GPS51EnhancedStateManager.STORAGE_KEY);
    console.log('GPS51EnhancedStateManager: State cleared with persistence cleanup');
  }

  /**
   * Export state for debugging/monitoring
   */
  exportStateForDebugging() {
    return {
      ...this.state,
      deviceSyncTimes: Object.fromEntries(this.state.deviceSyncTimes),
      deviceActivityStatus: Object.fromEntries(this.state.deviceActivityStatus),
      persistedStateExists: !!localStorage.getItem(GPS51EnhancedStateManager.STORAGE_KEY)
    };
  }
}