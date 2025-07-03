// GPS51 Real-time Update System - Phase 2.4 Complete Integration
// This module provides comprehensive real-time capabilities for GPS51 direct integration

import { GPS51WebSocketManager, gps51WebSocketManager } from './GPS51WebSocketManager';
import { GPS51EventBus, gps51EventBus } from './GPS51EventBus';
import { GPS51StateManager, gps51StateManager } from './GPS51StateManager';
import { GPS51UpdateQueue, gps51UpdateQueue } from './GPS51UpdateQueue';

export { GPS51WebSocketManager, gps51WebSocketManager } from './GPS51WebSocketManager';
export { GPS51EventBus, gps51EventBus } from './GPS51EventBus';
export { GPS51StateManager, gps51StateManager } from './GPS51StateManager';
export { GPS51UpdateQueue, gps51UpdateQueue } from './GPS51UpdateQueue';

// Re-export types for convenience
export type {
  WebSocketMessage,
  WebSocketConfig,
  WebSocketState,
  WebSocketEventHandler
} from './GPS51WebSocketManager';

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

// Integrated Real-time Manager for easy setup
export class GPS51RealTimeManager {
  private initialized = false;

  constructor() {
    this.setupIntegration();
  }

  private setupIntegration(): void {
    if (this.initialized) return;

    console.log('GPS51RealTimeManager: Initializing real-time integration...');

    // Setup WebSocket to EventBus integration
    gps51WebSocketManager.on('data', (message) => {
      gps51EventBus.emit('gps51.websocket.data', message.data, {
        source: 'websocket',
        priority: 'high'
      });
    });

    gps51WebSocketManager.on('connected', (message) => {
      gps51EventBus.emit('gps51.websocket.connected', message.data, {
        source: 'websocket',
        priority: 'normal'
      });
    });

    gps51WebSocketManager.on('disconnected', (message) => {
      gps51EventBus.emit('gps51.websocket.disconnected', message.data, {
        source: 'websocket',
        priority: 'high'
      });
    });

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
    console.log('GPS51RealTimeManager: Real-time integration initialized successfully');
  }

  async start(): Promise<boolean> {
    try {
      console.log('GPS51RealTimeManager: Starting real-time services...');
      
      // Start WebSocket connection
      const connected = await gps51WebSocketManager.connect();
      
      if (connected) {
        console.log('GPS51RealTimeManager: Real-time services started successfully');
        
        // Emit startup event
        gps51EventBus.emit('gps51.realtime.started', {
          timestamp: Date.now(),
          services: ['websocket', 'eventbus', 'statemanager', 'updatequeue']
        }, {
          source: 'realtime_manager',
          priority: 'normal'
        });
        
        return true;
      } else {
        console.warn('GPS51RealTimeManager: Failed to start WebSocket connection');
        return false;
      }
    } catch (error) {
      console.error('GPS51RealTimeManager: Failed to start real-time services:', error);
      return false;
    }
  }

  stop(): void {
    console.log('GPS51RealTimeManager: Stopping real-time services...');
    
    gps51WebSocketManager.disconnect();
    gps51UpdateQueue.pause();
    
    // Emit shutdown event
    gps51EventBus.emit('gps51.realtime.stopped', {
      timestamp: Date.now()
    }, {
      source: 'realtime_manager',
      priority: 'normal'
    });
    
    console.log('GPS51RealTimeManager: Real-time services stopped');
  }

  destroy(): void {
    console.log('GPS51RealTimeManager: Destroying real-time services...');
    
    gps51WebSocketManager.destroy();
    gps51UpdateQueue.destroy();
    gps51StateManager.destroy();
    gps51EventBus.destroy();
    
    this.initialized = false;
    
    console.log('GPS51RealTimeManager: Real-time services destroyed');
  }

  getSystemStatus() {
    return {
      initialized: this.initialized,
      websocket: {
        connected: gps51WebSocketManager.isConnected(),
        stats: gps51WebSocketManager.getConnectionStats()
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
export const GPS51_REALTIME_VERSION = '1.0.0';
export const GPS51_REALTIME_BUILD = 'phase2.4-complete';

console.log(`GPS51 Real-time Update System v${GPS51_REALTIME_VERSION} (${GPS51_REALTIME_BUILD}) loaded`);