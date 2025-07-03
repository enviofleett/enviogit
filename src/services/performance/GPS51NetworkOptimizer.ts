// GPS51 Network Optimizer - Phase 4.1
// Network usage optimization and intelligent connection management

import { gps51PerformanceMonitor } from './GPS51PerformanceMonitor';
import { gps51EventBus } from '../gps51/realtime';

export interface NetworkCondition {
  type: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'wifi' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // Round trip time in ms
  effectiveType: string;
  saveData: boolean;
}

export interface NetworkOptimization {
  compressionLevel: number;
  batchSize: number;
  pollingInterval: number;
  prefetchEnabled: boolean;
  cacheStrategy: 'aggressive' | 'normal' | 'minimal';
  imageQuality: 'low' | 'medium' | 'high';
  dataReduction: boolean;
}

export interface ConnectionHealth {
  status: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number;
  bandwidth: number;
  packetLoss: number;
  stability: number;
  lastCheck: Date;
}

export class GPS51NetworkOptimizer {
  private currentCondition: NetworkCondition | null = null;
  private connectionHealth: ConnectionHealth | null = null;
  private optimizations: NetworkOptimization;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private adaptiveMode = true;
  private offlineQueue: any[] = [];
  private retryQueue: any[] = [];

  constructor() {
    this.optimizations = this.getDefaultOptimizations();
    this.setupNetworkMonitoring();
    this.startHealthChecks();
    this.setupOfflineHandling();
  }

  // Network Condition Detection
  private setupNetworkMonitoring(): void {
    // Monitor connection type changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        this.updateNetworkCondition();
        
        connection.addEventListener('change', () => {
          this.updateNetworkCondition();
          this.adaptOptimizations();
        });
      }
    }

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });

    // Initial condition check
    this.updateNetworkCondition();
  }

  private updateNetworkCondition(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      this.currentCondition = {
        type: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        effectiveType: connection.effectiveType || 'unknown',
        saveData: connection.saveData || false
      };

      gps51PerformanceMonitor.recordMetric({
        name: 'network_condition',
        category: 'network',
        value: this.getConnectionScore(),
        unit: 'score',
        metadata: this.currentCondition
      });

      console.log('GPS51NetworkOptimizer: Network condition updated:', this.currentCondition);
    }
  }

  private getConnectionScore(): number {
    if (!this.currentCondition) return 50;

    const { type, downlink, rtt } = this.currentCondition;
    let score = 50;

    // Score based on connection type
    switch (type) {
      case '5g': score = 100; break;
      case '4g': score = 90; break;
      case 'wifi': score = 85; break;
      case '3g': score = 60; break;
      case '2g': score = 30; break;
      case 'slow-2g': score = 10; break;
      default: score = 50;
    }

    // Adjust based on actual performance
    if (downlink > 10) score = Math.min(100, score + 10);
    else if (downlink < 1) score = Math.max(0, score - 20);

    if (rtt < 100) score = Math.min(100, score + 5);
    else if (rtt > 500) score = Math.max(0, score - 15);

    return score;
  }

  // Connection Health Monitoring
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = performance.now();
    let success = false;
    let responseTime = 0;

    try {
      // Perform a lightweight ping to GPS51 API
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      responseTime = performance.now() - startTime;
      success = response.ok;

    } catch (error) {
      responseTime = performance.now() - startTime;
      success = false;
    }

    this.updateConnectionHealth(responseTime, success);
  }

  private updateConnectionHealth(latency: number, success: boolean): void {
    const bandwidth = this.currentCondition?.downlink || 0;
    
    // Calculate stability based on recent health checks
    const stability = this.calculateStability(success);
    
    // Determine overall status
    let status: ConnectionHealth['status'] = 'good';
    if (!success || latency > 5000) {
      status = 'offline';
    } else if (latency > 2000 || bandwidth < 0.5 || stability < 0.5) {
      status = 'poor';
    } else if (latency < 500 && bandwidth > 5 && stability > 0.9) {
      status = 'excellent';
    }

    this.connectionHealth = {
      status,
      latency,
      bandwidth,
      packetLoss: success ? 0 : 1,
      stability,
      lastCheck: new Date()
    };

    gps51PerformanceMonitor.recordMetric({
      name: 'connection_health',
      category: 'network',
      value: this.getHealthScore(),
      unit: 'score',
      metadata: this.connectionHealth
    });

    // Emit health update
    gps51EventBus.emit('gps51.network.health', this.connectionHealth, {
      source: 'network_optimizer',
      priority: status === 'poor' ? 'high' : 'normal'
    });
  }

  private calculateStability(currentSuccess: boolean): number {
    // Simplified stability calculation
    // In practice, this would track success rate over time
    return currentSuccess ? 0.95 : 0.3;
  }

  private getHealthScore(): number {
    if (!this.connectionHealth) return 50;

    const { status, latency, bandwidth, stability } = this.connectionHealth;
    
    let score = 50;
    
    switch (status) {
      case 'excellent': score = 95; break;
      case 'good': score = 75; break;
      case 'poor': score = 35; break;
      case 'offline': score = 0; break;
    }

    // Fine-tune based on metrics
    if (latency < 200) score += 5;
    else if (latency > 1000) score -= 10;

    if (bandwidth > 10) score += 5;
    else if (bandwidth < 1) score -= 10;

    score += (stability - 0.5) * 20;

    return Math.max(0, Math.min(100, score));
  }

  // Adaptive Optimizations
  private adaptOptimizations(): void {
    if (!this.adaptiveMode) return;

    const score = this.getConnectionScore();
    const healthScore = this.getHealthScore();
    const overallScore = (score + healthScore) / 2;

    if (overallScore > 80) {
      this.optimizations = {
        compressionLevel: 1,
        batchSize: 100,
        pollingInterval: 1000,
        prefetchEnabled: true,
        cacheStrategy: 'normal',
        imageQuality: 'high',
        dataReduction: false
      };
    } else if (overallScore > 60) {
      this.optimizations = {
        compressionLevel: 2,
        batchSize: 50,
        pollingInterval: 2000,
        prefetchEnabled: true,
        cacheStrategy: 'normal',
        imageQuality: 'medium',
        dataReduction: false
      };
    } else if (overallScore > 30) {
      this.optimizations = {
        compressionLevel: 3,
        batchSize: 25,
        pollingInterval: 5000,
        prefetchEnabled: false,
        cacheStrategy: 'aggressive',
        imageQuality: 'low',
        dataReduction: true
      };
    } else {
      this.optimizations = {
        compressionLevel: 4,
        batchSize: 10,
        pollingInterval: 10000,
        prefetchEnabled: false,
        cacheStrategy: 'minimal',
        imageQuality: 'low',
        dataReduction: true
      };
    }

    console.log('GPS51NetworkOptimizer: Optimizations adapted:', this.optimizations);
    
    // Notify components of optimization changes
    gps51EventBus.emit('gps51.network.optimizations', this.optimizations, {
      source: 'network_optimizer',
      priority: 'normal'
    });
  }

  // Offline Handling
  private setupOfflineHandling(): void {
    // Queue failed requests for retry when online
    gps51EventBus.on('gps51.request.failed', (event) => {
      if (!navigator.onLine) {
        this.queueForRetry(event.data);
      }
    });
  }

  private handleOffline(): void {
    console.log('GPS51NetworkOptimizer: Device went offline');
    
    gps51EventBus.emit('gps51.network.offline', {}, {
      source: 'network_optimizer',
      priority: 'high'
    });
  }

  private handleOnline(): void {
    console.log('GPS51NetworkOptimizer: Device back online');
    
    // Process offline queue
    this.processOfflineQueue();
    
    // Update network condition
    this.updateNetworkCondition();
    this.adaptOptimizations();
    
    gps51EventBus.emit('gps51.network.online', {}, {
      source: 'network_optimizer',
      priority: 'high'
    });
  }

  private queueForRetry(requestData: any): void {
    this.retryQueue.push({
      ...requestData,
      queuedAt: new Date(),
      retryCount: 0
    });
  }

  private async processOfflineQueue(): Promise<void> {
    console.log(`GPS51NetworkOptimizer: Processing ${this.retryQueue.length} queued requests`);
    
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const item of queue) {
      try {
        // Retry the request
        await this.retryRequest(item);
      } catch (error) {
        // Re-queue if retry fails
        if (item.retryCount < 3) {
          item.retryCount++;
          this.retryQueue.push(item);
        }
      }
    }
  }

  private async retryRequest(requestData: any): Promise<any> {
    // This would retry the actual request
    // For now, we'll just log it
    console.log('GPS51NetworkOptimizer: Retrying request:', requestData);
  }

  // Request Optimization
  optimizeRequest(url: string, options: RequestInit = {}): RequestInit {
    const optimizedOptions = { ...options };

    // Add compression headers
    if (this.optimizations.compressionLevel > 1) {
      optimizedOptions.headers = {
        ...optimizedOptions.headers,
        'Accept-Encoding': 'gzip, deflate, br'
      };
    }

    // Add data reduction headers
    if (this.optimizations.dataReduction) {
      optimizedOptions.headers = {
        ...optimizedOptions.headers,
        'X-Data-Reduction': 'true',
        'X-Image-Quality': this.optimizations.imageQuality
      };
    }

    // Set cache control based on strategy
    const cacheControl = this.getCacheControl();
    if (cacheControl) {
      optimizedOptions.headers = {
        ...optimizedOptions.headers,
        'Cache-Control': cacheControl
      };
    }

    return optimizedOptions;
  }

  private getCacheControl(): string | null {
    switch (this.optimizations.cacheStrategy) {
      case 'aggressive':
        return 'max-age=3600, stale-while-revalidate=1800';
      case 'normal':
        return 'max-age=300, stale-while-revalidate=150';
      case 'minimal':
        return 'max-age=60, must-revalidate';
      default:
        return null;
    }
  }

  // Prefetching
  shouldPrefetch(resourceType: string): boolean {
    return this.optimizations.prefetchEnabled && 
           this.getConnectionScore() > 60;
  }

  async prefetchResource(url: string): Promise<void> {
    if (!this.shouldPrefetch('data')) return;

    try {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);

      console.log('GPS51NetworkOptimizer: Prefetched resource:', url);
    } catch (error) {
      console.warn('GPS51NetworkOptimizer: Prefetch failed:', error);
    }
  }

  // Data Compression
  shouldCompress(dataSize: number): boolean {
    const threshold = this.getCompressionThreshold();
    return dataSize > threshold;
  }

  private getCompressionThreshold(): number {
    switch (this.optimizations.compressionLevel) {
      case 1: return 10240; // 10KB
      case 2: return 5120;  // 5KB
      case 3: return 2048;  // 2KB
      case 4: return 1024;  // 1KB
      default: return 10240;
    }
  }

  // Utility Methods
  private getDefaultOptimizations(): NetworkOptimization {
    return {
      compressionLevel: 2,
      batchSize: 50,
      pollingInterval: 2000,
      prefetchEnabled: true,
      cacheStrategy: 'normal',
      imageQuality: 'medium',
      dataReduction: false
    };
  }

  // Public API
  getCurrentCondition(): NetworkCondition | null {
    return this.currentCondition;
  }

  getConnectionHealth(): ConnectionHealth | null {
    return this.connectionHealth;
  }

  getOptimizations(): NetworkOptimization {
    return { ...this.optimizations };
  }

  setAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled;
    console.log(`GPS51NetworkOptimizer: Adaptive mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  forceOptimizations(optimizations: Partial<NetworkOptimization>): void {
    this.optimizations = {
      ...this.optimizations,
      ...optimizations
    };
    
    this.adaptiveMode = false;
    console.log('GPS51NetworkOptimizer: Forced optimizations applied:', optimizations);
  }

  getNetworkStats(): any {
    return {
      condition: this.currentCondition,
      health: this.connectionHealth,
      optimizations: this.optimizations,
      offlineQueueSize: this.retryQueue.length,
      adaptiveMode: this.adaptiveMode,
      connectionScore: this.getConnectionScore(),
      healthScore: this.getHealthScore()
    };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.retryQueue = [];
    this.offlineQueue = [];
    
    console.log('GPS51NetworkOptimizer: Destroyed');
  }
}

// Create singleton instance
export const gps51NetworkOptimizer = new GPS51NetworkOptimizer();