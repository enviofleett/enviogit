
export interface ScalingMetrics {
  activeVehicles: number;
  apiCallsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface LoadBalancingConfig {
  maxRequestsPerInstance: number;
  targetResponseTime: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
}

export class ScalingService {
  private static instance: ScalingService;
  private metrics: ScalingMetrics = {
    activeVehicles: 0,
    apiCallsPerMinute: 0,
    averageResponseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0
  };

  static getInstance(): ScalingService {
    if (!ScalingService.instance) {
      ScalingService.instance = new ScalingService();
    }
    return ScalingService.instance;
  }

  updateMetrics(newMetrics: Partial<ScalingMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics };
    this.evaluateScaling();
  }

  private evaluateScaling(): void {
    const config = this.getLoadBalancingConfig();
    
    // Scale up conditions
    if (this.shouldScaleUp(config)) {
      console.log('Scaling up GPS51 sync instances');
      this.triggerScaleUp();
    }
    
    // Scale down conditions
    if (this.shouldScaleDown(config)) {
      console.log('Scaling down GPS51 sync instances');
      this.triggerScaleDown();
    }
  }

  private shouldScaleUp(config: LoadBalancingConfig): boolean {
    return (
      this.metrics.apiCallsPerMinute > config.maxRequestsPerInstance ||
      this.metrics.averageResponseTime > config.targetResponseTime ||
      this.metrics.errorRate > config.scaleUpThreshold
    );
  }

  private shouldScaleDown(config: LoadBalancingConfig): boolean {
    return (
      this.metrics.apiCallsPerMinute < config.maxRequestsPerInstance * 0.5 &&
      this.metrics.averageResponseTime < config.targetResponseTime * 0.7 &&
      this.metrics.errorRate < config.scaleDownThreshold
    );
  }

  private triggerScaleUp(): void {
    // Trigger additional GPS51 sync instances
    this.invokeAdditionalSyncInstances();
  }

  private triggerScaleDown(): void {
    // Reduce GPS51 sync instances
    this.reduceeSyncInstances();
  }

  private async invokeAdditionalSyncInstances(): Promise<void> {
    // Distribute load across multiple edge function instances
    const instanceCount = Math.ceil(this.metrics.activeVehicles / 1000);
    
    for (let i = 0; i < instanceCount; i++) {
      const startIndex = i * 1000;
      const endIndex = Math.min((i + 1) * 1000, this.metrics.activeVehicles);
      
      // Invoke GPS51 sync with vehicle range
      fetch(`https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-sync`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceId: i,
          vehicleRange: { start: startIndex, end: endIndex },
          priority: 2
        })
      }).catch(error => console.error(`Sync instance ${i} failed:`, error));
    }
  }

  private reduceeSyncInstances(): void {
    // Reduce frequency or combine sync batches
    console.log('Reducing sync instance frequency');
  }

  private getLoadBalancingConfig(): LoadBalancingConfig {
    return {
      maxRequestsPerInstance: 1000,
      targetResponseTime: 2000,
      scaleUpThreshold: 0.1,
      scaleDownThreshold: 0.05,
      cooldownPeriod: 60000
    };
  }

  getMetrics(): ScalingMetrics {
    return { ...this.metrics };
  }
}

export const scalingService = ScalingService.getInstance();
