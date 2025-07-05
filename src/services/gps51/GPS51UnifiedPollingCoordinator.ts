import { GPS51CentralizedRequestManager } from './GPS51CentralizedRequestManager';
import type { GPS51Device, GPS51Position } from './GPS51Types';

export interface PollingSubscription {
  id: string;
  type: 'vehicles' | 'positions' | 'combined';
  callback: (data: any) => void;
  priority: 'low' | 'normal' | 'high';
  deviceIds?: string[];
  lastUpdate?: number;
}

export interface CachedData {
  vehicles: GPS51Device[];
  positions: GPS51Position[];
  lastVehicleUpdate: number;
  lastPositionUpdate: number;
}

/**
 * PHASE 1 EMERGENCY FIX: Unified Polling Coordinator
 * Routes ALL GPS51 polling through the centralized request manager
 * Implements aggressive caching and request deduplication
 */
export class GPS51UnifiedPollingCoordinator {
  private static instance: GPS51UnifiedPollingCoordinator;
  private requestManager: GPS51CentralizedRequestManager;
  private subscriptions = new Map<string, PollingSubscription>();
  private cache: CachedData;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private emergencyStop = false;

  // EMERGENCY INTERVALS - Very conservative
  private readonly VEHICLE_POLLING_INTERVAL = 180000; // 3 minutes
  private readonly POSITION_POLLING_INTERVAL = 120000; // 2 minutes  
  private readonly CACHE_TIMEOUT = 90000; // 1.5 minutes

  private constructor() {
    this.requestManager = GPS51CentralizedRequestManager.getInstance();
    this.cache = {
      vehicles: [],
      positions: [],
      lastVehicleUpdate: 0,
      lastPositionUpdate: 0
    };

    console.log('🚨 GPS51UnifiedPollingCoordinator: EMERGENCY MODE - Aggressive throttling protection');
  }

  static getInstance(): GPS51UnifiedPollingCoordinator {
    if (!GPS51UnifiedPollingCoordinator.instance) {
      GPS51UnifiedPollingCoordinator.instance = new GPS51UnifiedPollingCoordinator();
    }
    return GPS51UnifiedPollingCoordinator.instance;
  }

  /**
   * PHASE 1: Subscribe to GPS51 data updates
   */
  subscribe(
    type: 'vehicles' | 'positions' | 'combined',
    callback: (data: any) => void,
    options: {
      priority?: 'low' | 'normal' | 'high';
      deviceIds?: string[];
    } = {}
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const subscription: PollingSubscription = {
      id: subscriptionId,
      type,
      callback,
      priority: options.priority || 'normal',
      deviceIds: options.deviceIds,
      lastUpdate: 0
    };

    this.subscriptions.set(subscriptionId, subscription);
    
    console.log(`📡 GPS51UnifiedPollingCoordinator: New subscription ${subscriptionId}`, {
      type,
      priority: subscription.priority,
      totalSubscriptions: this.subscriptions.size
    });

    // Start polling if this is the first subscription
    if (this.subscriptions.size === 1 && !this.isPolling) {
      this.startUnifiedPolling();
    }

    // Return cached data immediately if available
    if (this.hasFreshData(type)) {
      setTimeout(() => {
        this.notifySubscription(subscription);
      }, 0);
    }

    return subscriptionId;
  }

  /**
   * PHASE 1: Unsubscribe from updates
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    
    console.log(`📡 GPS51UnifiedPollingCoordinator: Unsubscribed ${subscriptionId}`, {
      success: removed,
      remainingSubscriptions: this.subscriptions.size
    });

    // Stop polling if no more subscriptions
    if (this.subscriptions.size === 0) {
      this.stopUnifiedPolling();
    }

    return removed;
  }

  /**
   * PHASE 1: Manual refresh with deduplication
   */
  async refresh(type: 'vehicles' | 'positions' | 'combined' = 'combined'): Promise<void> {
    if (this.emergencyStop) {
      throw new Error('GPS51 API is in emergency stop mode due to throttling');
    }

    console.log(`🔄 GPS51UnifiedPollingCoordinator: Manual refresh requested: ${type}`);

    try {
      switch (type) {
        case 'vehicles':
          await this.fetchVehicles(true);
          break;
        case 'positions':
          await this.fetchPositions(true);
          break;
        case 'combined':
          await this.fetchVehicles(true);
          await this.fetchPositions(true);
          break;
      }
    } catch (error) {
      console.error('GPS51UnifiedPollingCoordinator: Manual refresh failed:', error);
      
      // Check if this is a throttling error
      if (this.isThrottlingError(error)) {
        this.activateEmergencyStop();
      }
      
      throw error;
    }
  }

  /**
   * PHASE 1: Start unified polling with aggressive rate limiting
   */
  private startUnifiedPolling(): void {
    if (this.isPolling || this.emergencyStop) {
      return;
    }

    this.isPolling = true;
    console.log('🚀 GPS51UnifiedPollingCoordinator: Starting unified polling');

    // Start with an immediate fetch
    this.performPollingCycle();

    // Set up periodic polling with staggered intervals
    this.pollingTimer = setInterval(() => {
      this.performPollingCycle();
    }, Math.min(this.VEHICLE_POLLING_INTERVAL, this.POSITION_POLLING_INTERVAL));
  }

  /**
   * PHASE 1: Stop all polling
   */
  private stopUnifiedPolling(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;
    
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    console.log('⏹️ GPS51UnifiedPollingCoordinator: Stopped unified polling');
  }

  /**
   * PHASE 1: Perform polling cycle with intelligent scheduling
   */
  private async performPollingCycle(): Promise<void> {
    if (this.emergencyStop) {
      console.warn('⚠️ GPS51UnifiedPollingCoordinator: Skipping polling cycle - emergency stop active');
      return;
    }

    const now = Date.now();
    const needsVehicleUpdate = now - this.cache.lastVehicleUpdate > this.VEHICLE_POLLING_INTERVAL;
    const needsPositionUpdate = now - this.cache.lastPositionUpdate > this.POSITION_POLLING_INTERVAL;

    console.log('🔄 GPS51UnifiedPollingCoordinator: Polling cycle check', {
      needsVehicleUpdate,
      needsPositionUpdate,
      vehicleAge: now - this.cache.lastVehicleUpdate,
      positionAge: now - this.cache.lastPositionUpdate
    });

    try {
      // Stagger requests to avoid API overload
      if (needsVehicleUpdate) {
        await this.fetchVehicles();
        
        // Wait between requests to avoid burst
        await this.delay(2000);
      }

      if (needsPositionUpdate) {
        await this.fetchPositions();
      }

    } catch (error) {
      console.error('GPS51UnifiedPollingCoordinator: Polling cycle failed:', error);
      
      if (this.isThrottlingError(error)) {
        this.activateEmergencyStop();
      }
    }
  }

  /**
   * PHASE 1: Fetch vehicles with deduplication
   */
  private async fetchVehicles(force = false): Promise<void> {
    const now = Date.now();
    
    if (!force && now - this.cache.lastVehicleUpdate < this.CACHE_TIMEOUT) {
      console.log('📦 GPS51UnifiedPollingCoordinator: Using cached vehicle data');
      return;
    }

    console.log('🚗 GPS51UnifiedPollingCoordinator: Fetching vehicles...');

    try {
      const response = await this.requestManager.makeRequest(
        'querymonitorlist',
        { username: 'current_user' }, // This should be replaced with actual username
        'POST',
        undefined,
        'normal'
      );

      if (response.status === 1 && response.groups) {
        const vehicles: GPS51Device[] = [];
        
        response.groups.forEach((group: any) => {
          if (group.devices && Array.isArray(group.devices)) {
            vehicles.push(...group.devices);
          }
        });

        this.cache.vehicles = vehicles;
        this.cache.lastVehicleUpdate = now;

        console.log(`✅ GPS51UnifiedPollingCoordinator: Vehicles updated (${vehicles.length} devices)`);
        
        // Notify vehicle subscriptions
        this.notifySubscriptions('vehicles');
      } else {
        throw new Error(`Vehicle fetch failed: ${response.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('GPS51UnifiedPollingCoordinator: Vehicle fetch failed:', error);
      throw error;
    }
  }

  /**
   * PHASE 1: Fetch positions with smart batching
   */
  private async fetchPositions(force = false): Promise<void> {
    const now = Date.now();
    
    if (!force && now - this.cache.lastPositionUpdate < this.CACHE_TIMEOUT) {
      console.log('📦 GPS51UnifiedPollingCoordinator: Using cached position data');
      return;
    }

    // Ensure we have vehicles first
    if (this.cache.vehicles.length === 0) {
      console.log('📍 GPS51UnifiedPollingCoordinator: No vehicles available for position fetch');
      return;
    }

    console.log('📍 GPS51UnifiedPollingCoordinator: Fetching positions...');

    try {
      // Get all device IDs from cached vehicles
      const deviceIds = this.cache.vehicles.map(v => v.deviceid);
      
      const response = await this.requestManager.makeRequest(
        'lastposition',
        { deviceids: deviceIds.join(',') },
        'POST',
        undefined,
        'high' // Positions are high priority
      );

      if (response.status === 1 && response.positions) {
        this.cache.positions = response.positions;
        this.cache.lastPositionUpdate = now;

        console.log(`✅ GPS51UnifiedPollingCoordinator: Positions updated (${response.positions.length} positions)`);
        
        // Notify position subscriptions
        this.notifySubscriptions('positions');
      } else {
        throw new Error(`Position fetch failed: ${response.message || 'Unknown error'}`);
      }

    } catch (error) {
      console.error('GPS51UnifiedPollingCoordinator: Position fetch failed:', error);
      throw error;
    }
  }

  /**
   * PHASE 1: Notify subscriptions with appropriate data
   */
  private notifySubscriptions(type: 'vehicles' | 'positions'): void {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === type || sub.type === 'combined');

    relevantSubscriptions.forEach(subscription => {
      this.notifySubscription(subscription);
    });
  }

  private notifySubscription(subscription: PollingSubscription): void {
    try {
      let data: any;

      switch (subscription.type) {
        case 'vehicles':
          data = {
            vehicles: this.cache.vehicles,
            lastUpdated: this.cache.lastVehicleUpdate
          };
          break;
        case 'positions':
          data = {
            positions: this.cache.positions,
            lastUpdated: this.cache.lastPositionUpdate
          };
          break;
        case 'combined':
          data = {
            vehicles: this.cache.vehicles,
            positions: this.cache.positions,
            lastVehicleUpdate: this.cache.lastVehicleUpdate,
            lastPositionUpdate: this.cache.lastPositionUpdate
          };
          break;
      }

      subscription.callback(data);
      subscription.lastUpdate = Date.now();

    } catch (error) {
      console.error(`GPS51UnifiedPollingCoordinator: Subscription callback failed:`, error);
    }
  }

  /**
   * PHASE 1: Emergency stop mechanism
   */
  private activateEmergencyStop(): void {
    this.emergencyStop = true;
    this.stopUnifiedPolling();
    
    console.error('🚨 GPS51UnifiedPollingCoordinator: EMERGENCY STOP ACTIVATED');
    console.log('⏰ Automatic recovery in 10 minutes');

    // Auto-recovery after 10 minutes
    setTimeout(() => {
      this.emergencyStop = false;
      console.log('🔄 GPS51UnifiedPollingCoordinator: Emergency stop cleared - resuming operations');
      
      if (this.subscriptions.size > 0) {
        this.startUnifiedPolling();
      }
    }, 600000); // 10 minutes
  }

  /**
   * PHASE 1: Emergency controls
   */
  emergencyReset(): void {
    console.warn('🚨 GPS51UnifiedPollingCoordinator: EMERGENCY RESET');
    
    this.emergencyStop = false;
    this.stopUnifiedPolling();
    this.subscriptions.clear();
    this.clearCache();
    this.requestManager.emergencyReset();
    
    console.log('✅ GPS51UnifiedPollingCoordinator: Emergency reset completed');
  }

  /**
   * PHASE 1: Utility methods
   */
  private hasFreshData(type: 'vehicles' | 'positions' | 'combined'): boolean {
    const now = Date.now();
    
    switch (type) {
      case 'vehicles':
        return this.cache.vehicles.length > 0 && 
               now - this.cache.lastVehicleUpdate < this.CACHE_TIMEOUT;
      case 'positions':
        return this.cache.positions.length > 0 && 
               now - this.cache.lastPositionUpdate < this.CACHE_TIMEOUT;
      case 'combined':
        return this.hasFreshData('vehicles') && this.hasFreshData('positions');
      default:
        return false;
    }
  }

  private isThrottlingError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('rate limit') || 
           message.includes('throttle') || 
           message.includes('8902') ||
           message.includes('too many requests');
  }

  private clearCache(): void {
    this.cache = {
      vehicles: [],
      positions: [],
      lastVehicleUpdate: 0,
      lastPositionUpdate: 0
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * PHASE 1: Status monitoring
   */
  getStatus() {
    const requestManagerHealth = this.requestManager.getHealthStatus();
    
    return {
      isPolling: this.isPolling,
      emergencyStop: this.emergencyStop,
      subscriptions: this.subscriptions.size,
      cache: {
        vehicleCount: this.cache.vehicles.length,
        positionCount: this.cache.positions.length,
        vehicleAge: Date.now() - this.cache.lastVehicleUpdate,
        positionAge: Date.now() - this.cache.lastPositionUpdate
      },
      requestManager: requestManagerHealth
    };
  }
}

// Export singleton instance
export const gps51UnifiedPollingCoordinator = GPS51UnifiedPollingCoordinator.getInstance();