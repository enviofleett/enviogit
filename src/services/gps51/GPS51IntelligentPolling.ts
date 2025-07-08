/**
 * GPS51 Intelligent Polling Manager - Phase 5
 * Smart vehicle state management and dynamic polling optimization
 */

export enum VehicleState {
  MOVING = 'moving',
  IDLING = 'idling',
  OFFLINE = 'offline',
  PARKED = 'parked'
}

export interface VehiclePollingProfile {
  deviceid: string;
  state: VehicleState;
  lastStateChange: number;
  consecutiveStateCount: number;
  pollingInterval: number;
  priority: number;
  lastPolled: number;
  speedHistory: number[];
  movingThreshold: number;
}

export interface PollingStrategy {
  state: VehicleState;
  baseInterval: number;
  maxInterval: number;
  escalationFactor: number;
  priority: number;
}

export class GPS51IntelligentPolling {
  private static instance: GPS51IntelligentPolling;
  
  private vehicleProfiles = new Map<string, VehiclePollingProfile>();
  private globalLastQueryTime: number = 0;
  
  private readonly pollingStrategies: Record<VehicleState, PollingStrategy> = {
    [VehicleState.MOVING]: {
      state: VehicleState.MOVING,
      baseInterval: 30000,    // 30 seconds
      maxInterval: 45000,     // 45 seconds max
      escalationFactor: 1.2,
      priority: 1
    },
    [VehicleState.IDLING]: {
      state: VehicleState.IDLING,
      baseInterval: 60000,    // 1 minute
      maxInterval: 180000,    // 3 minutes max
      escalationFactor: 1.5,
      priority: 2
    },
    [VehicleState.PARKED]: {
      state: VehicleState.PARKED,
      baseInterval: 300000,   // 5 minutes
      maxInterval: 600000,    // 10 minutes max
      escalationFactor: 1.3,
      priority: 3
    },
    [VehicleState.OFFLINE]: {
      state: VehicleState.OFFLINE,
      baseInterval: 600000,   // 10 minutes
      maxInterval: 1800000,   // 30 minutes max
      escalationFactor: 1.8,
      priority: 4
    }
  };

  static getInstance(): GPS51IntelligentPolling {
    if (!GPS51IntelligentPolling.instance) {
      GPS51IntelligentPolling.instance = new GPS51IntelligentPolling();
    }
    return GPS51IntelligentPolling.instance;
  }

  /**
   * Initialize or update vehicle profile
   */
  updateVehicleProfile(deviceid: string, position?: any): VehiclePollingProfile {
    const existing = this.vehicleProfiles.get(deviceid);
    const now = Date.now();
    
    if (!existing) {
      const profile: VehiclePollingProfile = {
        deviceid,
        state: VehicleState.OFFLINE,
        lastStateChange: now,
        consecutiveStateCount: 1,
        pollingInterval: this.pollingStrategies[VehicleState.OFFLINE].baseInterval,
        priority: 4,
        lastPolled: 0,
        speedHistory: [],
        movingThreshold: 5 // km/h
      };
      
      this.vehicleProfiles.set(deviceid, profile);
      return profile;
    }

    // Update with new position data if available
    if (position) {
      this.updateVehicleState(existing, position);
    }
    
    return existing;
  }

  /**
   * Update vehicle state based on position data
   */
  private updateVehicleState(profile: VehiclePollingProfile, position: any): void {
    const speed = position.speed || 0;
    const isOnline = position.updatetime && (Date.now() - position.updatetime * 1000) < 300000; // 5 min threshold
    
    // Update speed history
    profile.speedHistory.push(speed);
    if (profile.speedHistory.length > 10) {
      profile.speedHistory.shift();
    }

    // Determine new state
    let newState: VehicleState;
    
    if (!isOnline) {
      newState = VehicleState.OFFLINE;
    } else if (speed > profile.movingThreshold) {
      newState = VehicleState.MOVING;
    } else if (this.hasRecentMovement(profile)) {
      newState = VehicleState.IDLING;
    } else {
      newState = VehicleState.PARKED;
    }

    // Update state and intervals if changed
    if (newState !== profile.state) {
      console.log(`Vehicle ${profile.deviceid} state changed: ${profile.state} -> ${newState}`);
      profile.state = newState;
      profile.lastStateChange = Date.now();
      profile.consecutiveStateCount = 1;
      this.recalculatePollingInterval(profile);
    } else {
      profile.consecutiveStateCount++;
      this.adaptPollingInterval(profile);
    }
  }

  /**
   * Check if vehicle has recent movement history
   */
  private hasRecentMovement(profile: VehiclePollingProfile): boolean {
    const recentSpeeds = profile.speedHistory.slice(-5);
    return recentSpeeds.some(speed => speed > profile.movingThreshold);
  }

  /**
   * Recalculate polling interval based on state
   */
  private recalculatePollingInterval(profile: VehiclePollingProfile): void {
    const strategy = this.pollingStrategies[profile.state];
    profile.pollingInterval = strategy.baseInterval;
    profile.priority = strategy.priority;
  }

  /**
   * Adapt polling interval based on state persistence
   */
  private adaptPollingInterval(profile: VehiclePollingProfile): void {
    const strategy = this.pollingStrategies[profile.state];
    
    // Increase interval for persistent states (except moving)
    if (profile.state !== VehicleState.MOVING && profile.consecutiveStateCount > 3) {
      const factor = Math.min(strategy.escalationFactor, profile.consecutiveStateCount * 0.1);
      profile.pollingInterval = Math.min(
        profile.pollingInterval * factor,
        strategy.maxInterval
      );
    }
  }

  /**
   * Get vehicles ready for polling
   */
  getVehiclesReadyForPolling(): string[] {
    const now = Date.now();
    const readyVehicles: Array<{ deviceid: string; priority: number; timeDue: number }> = [];

    for (const [deviceid, profile] of this.vehicleProfiles) {
      const timeSinceLastPoll = now - profile.lastPolled;
      
      if (timeSinceLastPoll >= profile.pollingInterval) {
        readyVehicles.push({
          deviceid,
          priority: profile.priority,
          timeDue: timeSinceLastPoll - profile.pollingInterval
        });
      }
    }

    // Sort by priority (lower number = higher priority) then by time overdue
    readyVehicles.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.timeDue - a.timeDue;
    });

    return readyVehicles.map(v => v.deviceid);
  }

  /**
   * Mark vehicle as polled
   */
  markVehiclePolled(deviceid: string): void {
    const profile = this.vehicleProfiles.get(deviceid);
    if (profile) {
      profile.lastPolled = Date.now();
    }
  }

  /**
   * Get optimal batch size for polling
   */
  getOptimalBatchSize(): number {
    const movingVehicles = this.getVehiclesByState(VehicleState.MOVING).length;
    const idlingVehicles = this.getVehiclesByState(VehicleState.IDLING).length;
    
    // Prioritize moving vehicles, but don't exceed API limits
    if (movingVehicles > 0) {
      return Math.min(movingVehicles + Math.floor(idlingVehicles / 2), 20);
    }
    
    return Math.min(idlingVehicles + this.getVehiclesByState(VehicleState.PARKED).length, 30);
  }

  /**
   * Get vehicles by state
   */
  getVehiclesByState(state: VehicleState): VehiclePollingProfile[] {
    return Array.from(this.vehicleProfiles.values()).filter(profile => profile.state === state);
  }

  /**
   * Calculate global polling interval
   */
  calculateGlobalPollingInterval(): number {
    const movingCount = this.getVehiclesByState(VehicleState.MOVING).length;
    const idlingCount = this.getVehiclesByState(VehicleState.IDLING).length;
    const totalActive = movingCount + idlingCount;

    if (movingCount > 0) {
      return 30000; // 30 seconds when vehicles are moving
    } else if (totalActive > 0) {
      return 45000; // 45 seconds for idling vehicles
    }
    
    return 60000; // 1 minute default
  }

  /**
   * Get last query time for GPS51 API
   */
  getLastQueryTime(): number {
    return this.globalLastQueryTime;
  }

  /**
   * Update last query time
   */
  setLastQueryTime(timestamp: number): void {
    this.globalLastQueryTime = timestamp;
  }

  /**
   * Get polling statistics
   */
  getPollingStatistics() {
    const stats = {
      totalVehicles: this.vehicleProfiles.size,
      byState: {} as Record<VehicleState, number>,
      averageInterval: 0,
      readyForPolling: this.getVehiclesReadyForPolling().length
    };

    // Count vehicles by state
    for (const state of Object.values(VehicleState)) {
      stats.byState[state] = this.getVehiclesByState(state).length;
    }

    // Calculate average interval
    const intervals = Array.from(this.vehicleProfiles.values()).map(p => p.pollingInterval);
    stats.averageInterval = intervals.length > 0 
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
      : 0;

    return stats;
  }

  /**
   * Reset vehicle state (for testing/debugging)
   */
  resetVehicleState(deviceid: string): void {
    this.vehicleProfiles.delete(deviceid);
  }

  /**
   * Clear all profiles
   */
  clearAllProfiles(): void {
    this.vehicleProfiles.clear();
    this.globalLastQueryTime = 0;
  }
}

export const gps51IntelligentPolling = GPS51IntelligentPolling.getInstance();