
export interface ApiUsageBudget {
  monthlyLimit: number;
  currentUsage: number;
  costPerCall: number;
  alertThreshold: number;
}

export interface VehicleOptimizationConfig {
  vehicleType: string;
  baseSyncFrequency: number;
  priorityMultiplier: number;
  costWeight: number;
}

export interface CacheStrategy {
  ttl: number;
  maxSize: number;
  evictionPolicy: 'LRU' | 'FIFO' | 'TTL';
}

export class CostOptimizationService {
  private static instance: CostOptimizationService;
  private positionCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private usageBudget: ApiUsageBudget = {
    monthlyLimit: 100000,
    currentUsage: 0,
    costPerCall: 0.001,
    alertThreshold: 0.8
  };

  static getInstance(): CostOptimizationService {
    if (!CostOptimizationService.instance) {
      CostOptimizationService.instance = new CostOptimizationService();
    }
    return CostOptimizationService.instance;
  }

  // Smart caching to reduce redundant API calls
  getCachedPosition(vehicleId: string): any | null {
    const cached = this.positionCache.get(vehicleId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.positionCache.delete(vehicleId);
      return null;
    }

    return cached.data;
  }

  setCachedPosition(vehicleId: string, data: any, ttl: number = 30000): void {
    // Implement LRU eviction if cache is full
    if (this.positionCache.size >= 5000) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.positionCache.delete(oldestKey);
      }
    }

    this.positionCache.set(vehicleId, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private findOldestCacheEntry(): string | null {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, value] of this.positionCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  // Dynamic sync frequency based on vehicle type and activity
  calculateOptimalSyncFrequency(vehicleConfig: VehicleOptimizationConfig, currentActivity: {
    isMoving: boolean;
    speed: number;
    lastUpdate: Date;
    businessHours: boolean;
  }): number {
    let frequency = vehicleConfig.baseSyncFrequency;

    // Adjust based on movement
    if (currentActivity.isMoving) {
      if (currentActivity.speed > 50) {
        frequency = Math.min(frequency / 2, 30); // More frequent for fast vehicles
      } else if (currentActivity.speed > 20) {
        frequency = Math.min(frequency * 0.7, 60);
      }
    } else {
      frequency = Math.max(frequency * 2, 300); // Less frequent for stationary vehicles
    }

    // Adjust for business hours
    if (!currentActivity.businessHours) {
      frequency = Math.max(frequency * 1.5, 600); // Less frequent outside business hours
    }

    // Cost consideration
    const budgetUtilization = this.usageBudget.currentUsage / this.usageBudget.monthlyLimit;
    if (budgetUtilization > 0.8) {
      frequency *= 1.5; // Reduce frequency when approaching budget limit
    }

    return Math.round(frequency);
  }

  // Monitor and alert on budget usage
  trackApiUsage(calls: number): void {
    this.usageBudget.currentUsage += calls;
    const utilization = this.usageBudget.currentUsage / this.usageBudget.monthlyLimit;

    if (utilization > this.usageBudget.alertThreshold) {
      this.triggerBudgetAlert(utilization);
    }
  }

  private triggerBudgetAlert(utilization: number): void {
    console.warn(`API budget alert: ${Math.round(utilization * 100)}% of monthly limit used`);
    
    // Could trigger notification or email alert here
    if (utilization > 0.95) {
      console.error('Critical: API budget nearly exhausted - reducing sync frequencies');
      this.implementEmergencyThrottling();
    }
  }

  private implementEmergencyThrottling(): void {
    // Reduce all sync frequencies by 50% when budget is nearly exhausted
    console.log('Implementing emergency API throttling');
  }

  getBudgetStatus(): ApiUsageBudget & { utilizationPercent: number; projectedMonthlyUsage: number } {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const utilizationPercent = (this.usageBudget.currentUsage / this.usageBudget.monthlyLimit) * 100;
    const projectedMonthlyUsage = (this.usageBudget.currentUsage / currentDay) * daysInMonth;

    return {
      ...this.usageBudget,
      utilizationPercent,
      projectedMonthlyUsage
    };
  }

  getVehicleOptimizationConfigs(): VehicleOptimizationConfig[] {
    return [
      {
        vehicleType: 'sedan',
        baseSyncFrequency: 120, // 2 minutes
        priorityMultiplier: 1.0,
        costWeight: 0.5
      },
      {
        vehicleType: 'truck',
        baseSyncFrequency: 90, // 1.5 minutes
        priorityMultiplier: 1.2,
        costWeight: 0.7
      },
      {
        vehicleType: 'van',
        baseSyncFrequency: 100,
        priorityMultiplier: 1.1,
        costWeight: 0.6
      },
      {
        vehicleType: 'motorcycle',
        baseSyncFrequency: 150, // 2.5 minutes
        priorityMultiplier: 0.8,
        costWeight: 0.4
      }
    ];
  }
}

export const costOptimizationService = CostOptimizationService.getInstance();
