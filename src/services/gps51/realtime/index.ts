// GPS51 Real-time System - Emergency Mode
// All WebSocket and complex polling services have been removed to prevent API spikes

import { GPS51EventBus, gps51EventBus } from './GPS51EventBus';
import { GPS51StateManager, gps51StateManager } from './GPS51StateManager';
import { GPS51UpdateQueue, gps51UpdateQueue } from './GPS51UpdateQueue';

export { GPS51EventBus, gps51EventBus } from './GPS51EventBus';
export { GPS51StateManager, gps51StateManager } from './GPS51StateManager';
export { GPS51UpdateQueue, gps51UpdateQueue } from './GPS51UpdateQueue';

// Re-export types for convenience
export type {
  GPS51Event,
  GPS51EventHandler,
  EventSubscription,
  EventSubscriptionOptions,
  EventBusStats
} from './GPS51EventBus';

export type {
  GPS51StateSnapshot,
  StateUpdateEvent,
  StateSubscription
} from './GPS51StateManager';

export type {
  QueuedUpdate,
  BatchConfiguration,
  UpdateQueueStats
} from './GPS51UpdateQueue';

// Emergency Real-time Manager (WebSocket removed)
export class GPS51RealTimeManager {
  private initialized = false;

  constructor() {
    this.setupIntegration();
  }

  private setupIntegration(): void {
    if (this.initialized) return;

    console.log('GPS51RealTimeManager: Initializing emergency integration...');

    // Setup UpdateQueue to EventBus integration
    gps51EventBus.on('gps51.vehicles.updated', (event) => {
      gps51UpdateQueue.enqueue({
        type: 'vehicle',
        priority: 'normal',
        data: event.data,
        source: event.source,
        maxRetries: 3,
        batchKey: 'vehicle_updates'
      });
    });

    gps51EventBus.on('gps51.positions.updated', (event) => {
      gps51UpdateQueue.enqueue({
        type: 'position',
        priority: 'high',
        data: event.data,
        source: event.source,
        maxRetries: 3,
        batchKey: 'position_updates'
      });
    });

    // Setup EventBus to StateManager integration
    gps51EventBus.on('gps51.vehicles.batch_updated', (event) => {
      gps51StateManager.updateVehicles(event.data, event.source);
    });

    gps51EventBus.on('gps51.positions.batch_updated', (event) => {
      gps51StateManager.updatePositions(event.data, event.source);
    });

    this.initialized = true;
    console.log('GPS51RealTimeManager: Emergency integration initialized successfully');
  }

  async start(): Promise<boolean> {
    console.log('GPS51RealTimeManager: Emergency mode - no WebSocket connections');
    
    // Emit startup event
    gps51EventBus.emit('gps51.realtime.started', {
      timestamp: Date.now(),
      services: ['eventbus', 'statemanager', 'updatequeue'],
      mode: 'emergency'
    }, {
      source: 'realtime_manager',
      priority: 'normal'
    });
    
    return true;
  }

  stop(): void {
    console.log('GPS51RealTimeManager: Stopping emergency services...');
    
    gps51UpdateQueue.pause();
    
    // Emit shutdown event
    gps51EventBus.emit('gps51.realtime.stopped', {
      timestamp: Date.now()
    }, {
      source: 'realtime_manager',
      priority: 'normal'
    });
    
    console.log('GPS51RealTimeManager: Emergency services stopped');
  }

  destroy(): void {
    console.log('GPS51RealTimeManager: Destroying emergency services...');
    
    gps51UpdateQueue.destroy();
    gps51StateManager.destroy();
    gps51EventBus.destroy();
    
    this.initialized = false;
    
    console.log('GPS51RealTimeManager: Emergency services destroyed');
  }

  getSystemStatus() {
    return {
      initialized: this.initialized,
      mode: 'emergency',
      websocket: {
        connected: false,
        status: 'disabled_for_emergency'
      },
      eventBus: {
        stats: gps51EventBus.getStats()
      },
      stateManager: {
        stats: gps51StateManager.getStats()
      },
      updateQueue: {
        stats: gps51UpdateQueue.getStats(),
        queueInfo: gps51UpdateQueue.getQueueInfo()
      }
    };
  }

  // Convenience methods for common operations
  broadcastVehicleUpdate(vehicles: any[], source = 'api') {
    gps51EventBus.emit('gps51.vehicles.updated', vehicles, {
      source,
      priority: 'normal'
    });
  }

  broadcastPositionUpdate(positions: any[], source = 'api') {
    gps51EventBus.emit('gps51.positions.updated', positions, {
      source,
      priority: 'high'
    });
  }

  subscribeToStateChanges<T>(
    selector: (state: any) => T,
    callback: (newValue: T, previousValue: T) => void,
    options: any = {}
  ): string {
    return gps51StateManager.subscribe(selector, callback, options);
  }

  unsubscribeFromStateChanges(subscriptionId: string): boolean {
    return gps51StateManager.unsubscribe(subscriptionId);
  }
}

// Create singleton instance
export const gps51RealTimeManager = new GPS51RealTimeManager();

// Version and build info
export const GPS51_REALTIME_VERSION = '1.0.0-emergency';
export const GPS51_REALTIME_BUILD = 'emergency-api-spike-prevention';

console.log(`GPS51 Emergency Real-time System v${GPS51_REALTIME_VERSION} (${GPS51_REALTIME_BUILD}) loaded`);