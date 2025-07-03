import { gps51EventBus, GPS51Event } from './GPS51EventBus';
import type { GPS51Device, GPS51Position } from '../GPS51Types';

export interface GPS51StateSnapshot {
  vehicles: GPS51Device[];
  positions: Record<string, GPS51Position[]>; // deviceId -> positions
  connectionStatus: {
    isConnected: boolean;
    quality: string;
    latency: number;
    lastUpdate: number;
  };
  pollingStatus: {
    isActive: boolean;
    interval: number;
    efficiency: number;
    lastPoll: number;
  };
  metadata: {
    lastUpdated: number;
    version: number;
    source: string;
  };
}

export interface StateUpdateEvent {
  type: 'vehicles' | 'positions' | 'connection' | 'polling' | 'full';
  data: any;
  source: string;
  timestamp: number;
  previousState?: Partial<GPS51StateSnapshot>;
}

export interface StateSubscription {
  id: string;
  selector: (state: GPS51StateSnapshot) => any;
  callback: (newValue: any, previousValue: any, state: GPS51StateSnapshot) => void;
  options: {
    immediate?: boolean;
    deep?: boolean;
    throttle?: number;
  };
}

export class GPS51StateManager {
  private state: GPS51StateSnapshot;
  private subscribers = new Map<string, StateSubscription>();
  private updateQueue: StateUpdateEvent[] = [];
  private isProcessingUpdates = false;
  private stateHistory: GPS51StateSnapshot[] = [];
  private maxHistorySize = 50;

  constructor() {
    this.state = this.getInitialState();
    this.setupEventListeners();
  }

  private getInitialState(): GPS51StateSnapshot {
    return {
      vehicles: [],
      positions: {},
      connectionStatus: {
        isConnected: false,
        quality: 'poor',
        latency: 0,
        lastUpdate: 0
      },
      pollingStatus: {
        isActive: false,
        interval: 30000,
        efficiency: 0,
        lastPoll: 0
      },
      metadata: {
        lastUpdated: Date.now(),
        version: 1,
        source: 'initial'
      }
    };
  }

  private setupEventListeners(): void {
    // Listen to various GPS51 events and update state accordingly
    gps51EventBus.on('gps51.vehicles.updated', (event: GPS51Event) => {
      this.updateVehicles(event.data, event.source);
    });

    gps51EventBus.on('gps51.positions.updated', (event: GPS51Event) => {
      this.updatePositions(event.data, event.source);
    });

    gps51EventBus.on('gps51.connection.status', (event: GPS51Event) => {
      this.updateConnectionStatus(event.data, event.source);
    });

    gps51EventBus.on('gps51.polling.status', (event: GPS51Event) => {
      this.updatePollingStatus(event.data, event.source);
    });

    console.log('GPS51StateManager: Event listeners initialized');
  }

  // State update methods
  updateVehicles(vehicles: GPS51Device[], source = 'unknown'): void {
    const previousState = this.cloneState();
    
    this.state.vehicles = vehicles;
    this.state.metadata.lastUpdated = Date.now();
    this.state.metadata.version++;
    this.state.metadata.source = source;

    this.queueUpdate({
      type: 'vehicles',
      data: vehicles,
      source,
      timestamp: Date.now(),
      previousState: { vehicles: previousState.vehicles }
    });

    console.log('GPS51StateManager: Vehicles updated:', {
      count: vehicles.length,
      source,
      version: this.state.metadata.version
    });
  }

  updatePositions(positions: GPS51Position[], source = 'unknown'): void {
    const previousState = this.cloneState();
    
    // Group positions by device ID
    positions.forEach(position => {
      if (!this.state.positions[position.deviceid]) {
        this.state.positions[position.deviceid] = [];
      }
      
      // Add new position and keep only recent ones (last 10)
      const devicePositions = this.state.positions[position.deviceid];
      devicePositions.push(position);
      
      // Sort by timestamp and keep only the most recent
      devicePositions.sort((a, b) => b.updatetime - a.updatetime);
      this.state.positions[position.deviceid] = devicePositions.slice(0, 10);
    });

    this.state.metadata.lastUpdated = Date.now();
    this.state.metadata.version++;
    this.state.metadata.source = source;

    this.queueUpdate({
      type: 'positions',
      data: positions,
      source,
      timestamp: Date.now(),
      previousState: { positions: previousState.positions }
    });

    console.log('GPS51StateManager: Positions updated:', {
      positionCount: positions.length,
      devicesWithPositions: Object.keys(this.state.positions).length,
      source,
      version: this.state.metadata.version
    });
  }

  updateConnectionStatus(status: Partial<GPS51StateSnapshot['connectionStatus']>, source = 'unknown'): void {
    const previousState = this.cloneState();
    
    this.state.connectionStatus = {
      ...this.state.connectionStatus,
      ...status,
      lastUpdate: Date.now()
    };

    this.state.metadata.lastUpdated = Date.now();
    this.state.metadata.version++;
    this.state.metadata.source = source;

    this.queueUpdate({
      type: 'connection',
      data: status,
      source,
      timestamp: Date.now(),
      previousState: { connectionStatus: previousState.connectionStatus }
    });

    console.log('GPS51StateManager: Connection status updated:', {
      status: this.state.connectionStatus,
      source,
      version: this.state.metadata.version
    });
  }

  updatePollingStatus(status: Partial<GPS51StateSnapshot['pollingStatus']>, source = 'unknown'): void {
    const previousState = this.cloneState();
    
    this.state.pollingStatus = {
      ...this.state.pollingStatus,
      ...status,
      lastPoll: status.lastPoll || this.state.pollingStatus.lastPoll
    };

    this.state.metadata.lastUpdated = Date.now();
    this.state.metadata.version++;
    this.state.metadata.source = source;

    this.queueUpdate({
      type: 'polling',
      data: status,
      source,
      timestamp: Date.now(),
      previousState: { pollingStatus: previousState.pollingStatus }
    });

    console.log('GPS51StateManager: Polling status updated:', {
      status: this.state.pollingStatus,
      source,
      version: this.state.metadata.version
    });
  }

  // State subscription methods
  subscribe<T>(
    selector: (state: GPS51StateSnapshot) => T,
    callback: (newValue: T, previousValue: T, state: GPS51StateSnapshot) => void,
    options: StateSubscription['options'] = {}
  ): string {
    const subscription: StateSubscription = {
      id: this.generateSubscriptionId(),
      selector: selector as any,
      callback: callback as any,
      options: {
        immediate: false,
        deep: false,
        throttle: 0,
        ...options
      }
    };

    this.subscribers.set(subscription.id, subscription);

    // Call immediately if requested
    if (options.immediate) {
      try {
        const currentValue = selector(this.state);
        callback(currentValue, undefined as any, this.state);
      } catch (error) {
        console.error('GPS51StateManager: Immediate subscription callback error:', error);
      }
    }

    console.log('GPS51StateManager: Subscription created:', subscription.id);
    return subscription.id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscribers.delete(subscriptionId);
    
    if (removed) {
      console.log('GPS51StateManager: Subscription removed:', subscriptionId);
    }
    
    return removed;
  }

  // State access methods
  getState(): GPS51StateSnapshot {
    return this.cloneState();
  }

  getVehicles(): GPS51Device[] {
    return [...this.state.vehicles];
  }

  getVehicleById(deviceId: string): GPS51Device | undefined {
    return this.state.vehicles.find(v => v.deviceid === deviceId);
  }

  getPositions(deviceId?: string): GPS51Position[] {
    if (deviceId) {
      return [...(this.state.positions[deviceId] || [])];
    }
    
    // Return all positions
    const allPositions: GPS51Position[] = [];
    Object.values(this.state.positions).forEach(positions => {
      allPositions.push(...positions);
    });
    
    // Sort by timestamp
    return allPositions.sort((a, b) => b.updatetime - a.updatetime);
  }

  getLatestPosition(deviceId: string): GPS51Position | undefined {
    const positions = this.state.positions[deviceId];
    return positions && positions.length > 0 ? positions[0] : undefined;
  }

  getConnectionStatus(): GPS51StateSnapshot['connectionStatus'] {
    return { ...this.state.connectionStatus };
  }

  getPollingStatus(): GPS51StateSnapshot['pollingStatus'] {
    return { ...this.state.pollingStatus };
  }

  // Update processing
  private queueUpdate(update: StateUpdateEvent): void {
    this.updateQueue.push(update);
    this.processUpdatesAsync();
  }

  private async processUpdatesAsync(): Promise<void> {
    if (this.isProcessingUpdates) return;
    
    this.isProcessingUpdates = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift()!;
        await this.processUpdate(update);
      }
    } finally {
      this.isProcessingUpdates = false;
    }
  }

  private async processUpdate(update: StateUpdateEvent): Promise<void> {
    // Add to history
    this.addToHistory();
    
    // Notify subscribers
    await this.notifySubscribers(update);
    
    // Emit state change event
    gps51EventBus.emit('gps51.state.updated', {
      updateType: update.type,
      state: this.cloneState(),
      update
    }, {
      source: 'state_manager',
      priority: 'normal'
    });
  }

  private async notifySubscribers(update: StateUpdateEvent): Promise<void> {
    const notificationPromises: Promise<void>[] = [];
    
    for (const subscription of this.subscribers.values()) {
      notificationPromises.push(this.notifySubscriber(subscription, update));
    }
    
    await Promise.all(notificationPromises);
  }

  private async notifySubscriber(subscription: StateSubscription, update: StateUpdateEvent): Promise<void> {
    try {
      const currentValue = subscription.selector(this.state);
      const previousValue = update.previousState ? subscription.selector({
        ...this.state,
        ...update.previousState
      } as GPS51StateSnapshot) : undefined;
      
      // Check if value actually changed (simple comparison)
      if (subscription.options.deep || currentValue !== previousValue) {
        await subscription.callback(currentValue, previousValue, this.state);
      }
    } catch (error) {
      console.error('GPS51StateManager: Subscriber notification error:', {
        subscriptionId: subscription.id,
        updateType: update.type,
        error
      });
    }
  }

  // Utility methods
  private cloneState(): GPS51StateSnapshot {
    return JSON.parse(JSON.stringify(this.state));
  }

  private addToHistory(): void {
    this.stateHistory.push(this.cloneState());
    
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private generateSubscriptionId(): string {
    return `state_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getStateHistory(limit = 10): GPS51StateSnapshot[] {
    return this.stateHistory.slice(-limit);
  }

  getSubscribers(): StateSubscription[] {
    return Array.from(this.subscribers.values());
  }

  reset(): void {
    this.state = this.getInitialState();
    this.stateHistory = [];
    this.updateQueue = [];
    
    console.log('GPS51StateManager: State reset to initial values');
  }

  clearHistory(): void {
    this.stateHistory = [];
    console.log('GPS51StateManager: State history cleared');
  }

  clearSubscribers(): void {
    this.subscribers.clear();
    console.log('GPS51StateManager: All subscribers cleared');
  }

  destroy(): void {
    this.clearSubscribers();
    this.clearHistory();
    this.updateQueue = [];
    
    console.log('GPS51StateManager: Destroyed');
  }

  // Debug methods
  getStats() {
    return {
      stateVersion: this.state.metadata.version,
      lastUpdated: this.state.metadata.lastUpdated,
      vehicleCount: this.state.vehicles.length,
      devicesWithPositions: Object.keys(this.state.positions).length,
      totalPositions: Object.values(this.state.positions).reduce((sum, positions) => sum + positions.length, 0),
      subscriberCount: this.subscribers.size,
      historySize: this.stateHistory.length,
      queueSize: this.updateQueue.length,
      isProcessingUpdates: this.isProcessingUpdates
    };
  }
}

// Create singleton instance
export const gps51StateManager = new GPS51StateManager();
