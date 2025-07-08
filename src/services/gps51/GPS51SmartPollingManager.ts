import { gps51EventBus } from './realtime/GPS51EventBus';
import { gps51UpdateQueue } from './realtime/GPS51UpdateQueue';

export interface PollingStrategy {
  vehicleId: string;
  baseInterval: number;
  currentInterval: number;
  lastActivity: number;
  isMoving: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  consecutiveInactivePolls: number;
  networkCondition: 'fast' | 'normal' | 'slow';
}

export interface NetworkConditions {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | unknown;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export class GPS51SmartPollingManager {
  private strategies = new Map<string, PollingStrategy>();
  private timers = new Map<string, NodeJS.Timeout>();
  private networkConditions: NetworkConditions = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false
  };
  
  private readonly config = {
    // Base intervals in milliseconds
    movingVehicleInterval: 15000,    // 15 seconds for moving vehicles
    stationaryVehicleInterval: 60000, // 1 minute for stationary
    inactiveVehicleInterval: 300000,  // 5 minutes for inactive
    maxInactivePolls: 10,             // After 10 inactive polls, reduce frequency
    
    // Network-based adjustments
    networkMultipliers: {
      'fast': 1.0,
      'normal': 1.5,
      'slow': 2.5
    },
    
    // Priority-based adjustments
    priorityMultipliers: {
      'critical': 0.5,
      'high': 0.75,
      'normal': 1.0,
      'low': 2.0
    }
  };

  constructor() {
    this.initializeNetworkMonitoring();
    this.setupEventListeners();
  }

  private initializeNetworkMonitoring(): void {
    // Monitor network conditions if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkConditions = () => {
        this.networkConditions = {
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 100,
          saveData: connection.saveData || false
        };
        
        this.adjustAllStrategiesForNetwork();
      };
      
      connection.addEventListener('change', updateNetworkConditions);
      updateNetworkConditions();
    }
  }

  private setupEventListeners(): void {
    // Listen for vehicle updates to adjust polling strategies
    gps51EventBus.on('gps51.vehicles.updated', (vehicles: any) => {
      if (Array.isArray(vehicles)) {
        vehicles.forEach((vehicle: any) => {
          this.updateVehicleStrategy(vehicle);
        });
      }
    });

    // Listen for position updates
    gps51EventBus.on('gps51.positions.updated', (positions: any) => {
      if (Array.isArray(positions)) {
        positions.forEach((position: any) => {
          if (position.deviceid) {
            this.updateVehicleActivity(position.deviceid, position);
          }
        });
      }
    });
  }

  // Main polling strategy management
  startPollingForVehicle(vehicleId: string, options: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    isMoving?: boolean;
  } = {}): void {
    const strategy: PollingStrategy = {
      vehicleId,
      baseInterval: this.config.movingVehicleInterval,
      currentInterval: this.config.movingVehicleInterval,
      lastActivity: Date.now(),
      isMoving: options.isMoving || false,
      priority: options.priority || 'normal',
      consecutiveInactivePolls: 0,
      networkCondition: this.getNetworkCondition()
    };

    this.strategies.set(vehicleId, strategy);
    this.calculateOptimalInterval(strategy);
    this.scheduleNextPoll(vehicleId);

    console.log('GPS51SmartPollingManager: Started polling for vehicle:', {
      vehicleId,
      strategy: {
        currentInterval: strategy.currentInterval,
        priority: strategy.priority,
        networkCondition: strategy.networkCondition
      }
    });
  }

  stopPollingForVehicle(vehicleId: string): void {
    const timer = this.timers.get(vehicleId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(vehicleId);
    }
    
    this.strategies.delete(vehicleId);
    console.log('GPS51SmartPollingManager: Stopped polling for vehicle:', vehicleId);
  }

  updateVehicleStrategy(vehicle: any): void {
    const strategy = this.strategies.get(vehicle.device?.deviceid);
    if (!strategy) return;

    const wasMoving = strategy.isMoving;
    const isNowMoving = vehicle.isMoving || vehicle.speed > 0;
    
    // Update strategy based on vehicle state
    strategy.isMoving = isNowMoving;
    strategy.lastActivity = Date.now();
    
    // Reset inactive poll count if vehicle became active
    if (!wasMoving && isNowMoving) {
      strategy.consecutiveInactivePolls = 0;
    }

    this.calculateOptimalInterval(strategy);
    
    // Reschedule if interval changed significantly
    const intervalChange = Math.abs(strategy.currentInterval - this.getLastUsedInterval(vehicle.device.deviceid));
    if (intervalChange > 5000) { // 5 second threshold
      this.rescheduleVehiclePoll(vehicle.device.deviceid);
    }
  }

  private updateVehicleActivity(vehicleId: string, position: any): void {
    const strategy = this.strategies.get(vehicleId);
    if (!strategy) return;

    const hasMovement = position.speed > 0 || 
                       (position.latitude !== strategy.lastActivity && 
                        position.longitude !== strategy.lastActivity);

    if (hasMovement) {
      strategy.consecutiveInactivePolls = 0;
      strategy.lastActivity = Date.now();
      strategy.isMoving = true;
    } else {
      strategy.consecutiveInactivePolls++;
      strategy.isMoving = false;
    }

    this.calculateOptimalInterval(strategy);
  }

  private calculateOptimalInterval(strategy: PollingStrategy): void {
    let interval = strategy.baseInterval;

    // Adjust based on vehicle movement
    if (strategy.isMoving) {
      interval = this.config.movingVehicleInterval;
    } else if (strategy.consecutiveInactivePolls > this.config.maxInactivePolls) {
      interval = this.config.inactiveVehicleInterval;
    } else {
      interval = this.config.stationaryVehicleInterval;
    }

    // Apply priority multiplier
    interval *= this.config.priorityMultipliers[strategy.priority];

    // Apply network condition multiplier
    interval *= this.config.networkMultipliers[strategy.networkCondition];

    // Apply data saver mode if enabled
    if (this.networkConditions.saveData) {
      interval *= 2;
    }

    // Ensure minimum interval of 10 seconds
    interval = Math.max(interval, 10000);

    strategy.currentInterval = Math.round(interval);
  }

  private getNetworkCondition(): 'fast' | 'normal' | 'slow' {
    const { effectiveType, downlink } = this.networkConditions;
    
    if (effectiveType === '4g' && downlink > 5) return 'fast';
    if (effectiveType === '3g' || (effectiveType === '4g' && downlink <= 5)) return 'normal';
    return 'slow';
  }

  private adjustAllStrategiesForNetwork(): void {
    this.strategies.forEach((strategy, vehicleId) => {
      strategy.networkCondition = this.getNetworkCondition();
      this.calculateOptimalInterval(strategy);
      this.rescheduleVehiclePoll(vehicleId);
    });
  }

  private scheduleNextPoll(vehicleId: string): void {
    const strategy = this.strategies.get(vehicleId);
    if (!strategy) return;

    const timer = setTimeout(() => {
      this.executePoll(vehicleId);
    }, strategy.currentInterval);

    this.timers.set(vehicleId, timer);
  }

  private rescheduleVehiclePoll(vehicleId: string): void {
    const timer = this.timers.get(vehicleId);
    if (timer) {
      clearTimeout(timer);
    }
    this.scheduleNextPoll(vehicleId);
  }

  private async executePoll(vehicleId: string): Promise<void> {
    const strategy = this.strategies.get(vehicleId);
    if (!strategy) return;

    try {
      // Queue position fetch for this vehicle
      gps51UpdateQueue.enqueue({
        type: 'custom',
        priority: strategy.priority,
        data: {
          eventType: 'gps51.position.fetch_request',
          eventData: { vehicleId, timestamp: Date.now() }
        },
        source: 'smart_polling_manager',
        maxRetries: 2,
        batchKey: 'position_fetches'
      });

      console.log('GPS51SmartPollingManager: Executed poll for vehicle:', {
        vehicleId,
        interval: strategy.currentInterval,
        consecutiveInactive: strategy.consecutiveInactivePolls
      });

    } catch (error) {
      console.error('GPS51SmartPollingManager: Poll execution failed:', {
        vehicleId,
        error: error instanceof Error ? error.message : error
      });
    }

    // Schedule next poll
    this.scheduleNextPoll(vehicleId);
  }

  private getLastUsedInterval(vehicleId: string): number {
    const strategy = this.strategies.get(vehicleId);
    return strategy?.currentInterval || this.config.movingVehicleInterval;
  }

  // Batch operations for efficiency
  startBatchPolling(vehicleIds: string[], options: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    staggerInterval?: number;
  } = {}): void {
    const stagger = options.staggerInterval || 1000; // 1 second stagger

    vehicleIds.forEach((vehicleId, index) => {
      setTimeout(() => {
        this.startPollingForVehicle(vehicleId, {
          priority: options.priority
        });
      }, index * stagger);
    });

    console.log('GPS51SmartPollingManager: Started batch polling for vehicles:', {
      count: vehicleIds.length,
      stagger,
      priority: options.priority
    });
  }

  // Public API
  getPollingStats() {
    const stats = {
      activeVehicles: this.strategies.size,
      averageInterval: 0,
      networkCondition: this.getNetworkCondition(),
      strategies: [] as any[]
    };

    if (this.strategies.size > 0) {
      const totalInterval = Array.from(this.strategies.values())
        .reduce((sum, strategy) => sum + strategy.currentInterval, 0);
      stats.averageInterval = totalInterval / this.strategies.size;
    }

    stats.strategies = Array.from(this.strategies.values()).map(strategy => ({
      vehicleId: strategy.vehicleId,
      currentInterval: strategy.currentInterval,
      isMoving: strategy.isMoving,
      priority: strategy.priority,
      consecutiveInactivePolls: strategy.consecutiveInactivePolls
    }));

    return stats;
  }

  updateVehiclePriority(vehicleId: string, priority: 'low' | 'normal' | 'high' | 'critical'): void {
    const strategy = this.strategies.get(vehicleId);
    if (strategy) {
      strategy.priority = priority;
      this.calculateOptimalInterval(strategy);
      this.rescheduleVehiclePoll(vehicleId);
    }
  }

  pausePolling(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    console.log('GPS51SmartPollingManager: All polling paused');
  }

  resumePolling(): void {
    this.strategies.forEach((_, vehicleId) => {
      this.scheduleNextPoll(vehicleId);
    });
    console.log('GPS51SmartPollingManager: All polling resumed');
  }

  destroy(): void {
    this.pausePolling();
    this.strategies.clear();
    console.log('GPS51SmartPollingManager: Destroyed');
  }
}

// Create singleton instance
export const gps51SmartPollingManager = new GPS51SmartPollingManager();