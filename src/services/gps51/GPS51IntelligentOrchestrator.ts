// GPS51 Intelligent Orchestration Service - Production Implementation
// Centralized backend service for managing all GPS51 API interactions with intelligent polling

import { GPS51AdaptivePollingService } from './GPS51AdaptivePollingService';
import { gps51Client } from './GPS51Client';
import { supabase } from '@/integrations/supabase/client';
import type { GPS51Device, GPS51Position } from './types';

export interface UserActivityProfile {
  userId: string;
  activeVehicleIds: Set<string>;
  lastActivity: Date;
  isViewingRealTime: boolean;
  preferredPollingInterval: number;
}

export interface VehiclePollingStrategy {
  deviceId: string;
  isMoving: boolean;
  hasActiveUsers: boolean;
  lastPosition?: GPS51Position;
  currentInterval: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OrchestratorMetrics {
  totalApiCalls: number;
  callsPerMinute: number;
  activePollingVehicles: number;
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
  averageResponseTime: number;
  successRate: number;
  lastApiCall: Date | null;
  riskLevel: 'low' | 'medium' | 'high';
}

export class GPS51IntelligentOrchestrator {
  private static instance: GPS51IntelligentOrchestrator;
  private adaptivePollingService: GPS51AdaptivePollingService;
  private userActivityProfiles = new Map<string, UserActivityProfile>();
  private vehicleStrategies = new Map<string, VehiclePollingStrategy>();
  private lastQueryTimes = new Map<string, number>();
  private orchestratorMetrics: OrchestratorMetrics;
  private isRunning = false;
  private pollingJobQueue: Array<{ deviceIds: string[]; priority: number }> = [];

  static getInstance(): GPS51IntelligentOrchestrator {
    if (!GPS51IntelligentOrchestrator.instance) {
      GPS51IntelligentOrchestrator.instance = new GPS51IntelligentOrchestrator();
    }
    return GPS51IntelligentOrchestrator.instance;
  }

  constructor() {
    this.adaptivePollingService = new GPS51AdaptivePollingService({
      basePollingInterval: 30000, // 30 seconds default
      minPollingInterval: 5000,   // 5 seconds minimum for high-priority
      maxPollingInterval: 300000, // 5 minutes maximum for idle vehicles
      maxRetries: 3,
      enableAdaptivePolling: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      enableIntelligentBackoff: true
    });

    this.orchestratorMetrics = {
      totalApiCalls: 0,
      callsPerMinute: 0,
      activePollingVehicles: 0,
      circuitBreakerStatus: 'closed',
      averageResponseTime: 0,
      successRate: 0,
      lastApiCall: null,
      riskLevel: 'low'
    };

    // Initialize API rate monitoring
    this.initializeRateMonitoring();
  }

  /**
   * Start the intelligent orchestration system
   */
  async startOrchestration(): Promise<boolean> {
    if (this.isRunning) {
      console.warn('GPS51IntelligentOrchestrator: Already running');
      return true;
    }

    try {
      console.log('GPS51IntelligentOrchestrator: Starting intelligent GPS51 orchestration...');
      
      // Load initial vehicle fleet
      await this.loadVehicleFleet();
      
      // Start adaptive polling with intelligent callback
      this.adaptivePollingService.startPolling(
        () => this.executeIntelligentPolling(),
        () => this.getRecommendedPollingInterval()
      );

      this.isRunning = true;
      console.log('GPS51IntelligentOrchestrator: Orchestration started successfully');
      return true;
    } catch (error) {
      console.error('GPS51IntelligentOrchestrator: Failed to start orchestration:', error);
      return false;
    }
  }

  /**
   * Stop orchestration
   */
  stopOrchestration(): void {
    console.log('GPS51IntelligentOrchestrator: Stopping orchestration...');
    this.adaptivePollingService.stopPolling();
    this.isRunning = false;
    this.clearUserActivityProfiles();
    console.log('GPS51IntelligentOrchestrator: Orchestration stopped');
  }

  /**
   * Register user activity for intelligent polling adjustment
   */
  registerUserActivity(userId: string, vehicleIds: string[], isViewingRealTime = false): void {
    const profile: UserActivityProfile = {
      userId,
      activeVehicleIds: new Set(vehicleIds),
      lastActivity: new Date(),
      isViewingRealTime,
      preferredPollingInterval: isViewingRealTime ? 10000 : 30000 // 10s for real-time, 30s for dashboard
    };

    this.userActivityProfiles.set(userId, profile);
    
    // Update vehicle strategies based on user activity
    this.updateVehicleStrategies();

    console.log('GPS51IntelligentOrchestrator: User activity registered', {
      userId,
      vehicleCount: vehicleIds.length,
      isViewingRealTime,
      totalActiveUsers: this.userActivityProfiles.size
    });
  }

  /**
   * Unregister user activity
   */
  unregisterUserActivity(userId: string): void {
    this.userActivityProfiles.delete(userId);
    this.updateVehicleStrategies();
    console.log('GPS51IntelligentOrchestrator: User activity unregistered', { userId });
  }

  /**
   * Execute intelligent polling based on current strategies
   */
  private async executeIntelligentPolling(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get high-priority vehicles (active users, moving vehicles)
      const highPriorityVehicles = Array.from(this.vehicleStrategies.values())
        .filter(strategy => strategy.priority === 'high')
        .map(strategy => strategy.deviceId);

      // Get medium-priority vehicles
      const mediumPriorityVehicles = Array.from(this.vehicleStrategies.values())
        .filter(strategy => strategy.priority === 'medium')
        .map(strategy => strategy.deviceId);

      // Execute polling in priority order with batching
      if (highPriorityVehicles.length > 0) {
        await this.executeBatchPolling(highPriorityVehicles, 'high');
      }

      if (mediumPriorityVehicles.length > 0) {
        await this.executeBatchPolling(mediumPriorityVehicles, 'medium');
      }

      // Update metrics
      this.updateMetrics(Date.now() - startTime, true);

      console.log('GPS51IntelligentOrchestrator: Intelligent polling cycle completed', {
        highPriorityCount: highPriorityVehicles.length,
        mediumPriorityCount: mediumPriorityVehicles.length,
        executionTime: Date.now() - startTime
      });

    } catch (error) {
      console.error('GPS51IntelligentOrchestrator: Polling execution failed:', error);
      this.updateMetrics(0, false);
      throw error;
    }
  }

  /**
   * Execute batch polling for specific vehicle groups
   */
  private async executeBatchPolling(deviceIds: string[], priority: string): Promise<void> {
    if (deviceIds.length === 0) return;

    try {
      // Get batch lastQueryTime - use the oldest one to ensure no data is missed
      let batchLastQueryTime = 0;
      for (const deviceId of deviceIds) {
        const lastTime = this.lastQueryTimes.get(deviceId) || 0;
        if (batchLastQueryTime === 0 || lastTime < batchLastQueryTime) {
          batchLastQueryTime = lastTime;
        }
      }

      console.log(`GPS51IntelligentOrchestrator: Executing ${priority} priority batch polling`, {
        deviceCount: deviceIds.length,
        lastQueryTime: batchLastQueryTime
      });

      // Fetch positions using lastquerypositiontime for efficiency
      const result = await gps51Client.getRealtimePositions(deviceIds, batchLastQueryTime);
      
      // Update lastQueryTimes for all devices
      for (const deviceId of deviceIds) {
        this.lastQueryTimes.set(deviceId, result.lastQueryTime);
      }

      // Process and store positions
      if (result.positions.length > 0) {
        await this.processAndStorePositions(result.positions);
        
        // Update vehicle movement status for strategy adjustment
        this.updateVehicleMovementStatus(result.positions);

        // Broadcast real-time updates via WebSocket
        this.broadcastPositionUpdates(result.positions);
      }

      console.log(`GPS51IntelligentOrchestrator: Batch polling completed for ${priority} priority`, {
        positionsReceived: result.positions.length,
        newLastQueryTime: result.lastQueryTime
      });

    } catch (error) {
      console.error(`GPS51IntelligentOrchestrator: Batch polling failed for ${priority} priority:`, error);
      throw error;
    }
  }

  /**
   * Load vehicle fleet and initialize strategies
   */
  private async loadVehicleFleet(): Promise<void> {
    try {
      const { data: vehicles, error } = await supabase
        .from('vehicles')
        .select('id, gps51_device_id, make, model')
        .not('gps51_device_id', 'is', null);

      if (error) throw error;

      // Initialize vehicle strategies
      for (const vehicle of vehicles || []) {
        this.vehicleStrategies.set(vehicle.gps51_device_id, {
          deviceId: vehicle.gps51_device_id,
          isMoving: false,
          hasActiveUsers: false,
          currentInterval: 60000, // Start with 1 minute intervals
          priority: 'low'
        });
      }

      console.log('GPS51IntelligentOrchestrator: Vehicle fleet loaded', {
        vehicleCount: vehicles?.length || 0
      });
    } catch (error) {
      console.error('GPS51IntelligentOrchestrator: Failed to load vehicle fleet:', error);
      throw error;
    }
  }

  /**
   * Update vehicle strategies based on user activity and movement
   */
  private updateVehicleStrategies(): void {
    // Reset all vehicles to low priority
    for (const strategy of this.vehicleStrategies.values()) {
      strategy.hasActiveUsers = false;
      strategy.priority = 'low';
      strategy.currentInterval = 300000; // 5 minutes for inactive vehicles
    }

    // Update based on active user profiles
    for (const profile of this.userActivityProfiles.values()) {
      for (const vehicleId of profile.activeVehicleIds) {
        const strategy = this.vehicleStrategies.get(vehicleId);
        if (strategy) {
          strategy.hasActiveUsers = true;
          strategy.currentInterval = profile.preferredPollingInterval;
          
          // Determine priority
          if (profile.isViewingRealTime) {
            strategy.priority = 'high';
            strategy.currentInterval = 10000; // 10 seconds for real-time viewing
          } else if (strategy.isMoving) {
            strategy.priority = 'high';
            strategy.currentInterval = 15000; // 15 seconds for moving vehicles
          } else {
            strategy.priority = 'medium';
            strategy.currentInterval = 30000; // 30 seconds for monitored stationary vehicles
          }
        }
      }
    }

    // Count active polling vehicles
    this.orchestratorMetrics.activePollingVehicles = Array.from(this.vehicleStrategies.values())
      .filter(strategy => strategy.priority !== 'low').length;

    console.log('GPS51IntelligentOrchestrator: Vehicle strategies updated', {
      highPriority: Array.from(this.vehicleStrategies.values()).filter(s => s.priority === 'high').length,
      mediumPriority: Array.from(this.vehicleStrategies.values()).filter(s => s.priority === 'medium').length,
      lowPriority: Array.from(this.vehicleStrategies.values()).filter(s => s.priority === 'low').length
    });
  }

  /**
   * Update vehicle movement status from position data
   */
  private updateVehicleMovementStatus(positions: GPS51Position[]): void {
    for (const position of positions) {
      const strategy = this.vehicleStrategies.get(position.deviceid);
      if (strategy) {
        const wasMoving = strategy.isMoving;
        strategy.isMoving = position.moving === 1;
        strategy.lastPosition = position;

        // If movement status changed, update strategies
        if (wasMoving !== strategy.isMoving) {
          this.updateVehicleStrategies();
        }
      }
    }
  }

  /**
   * Process and store position data
   */
  private async processAndStorePositions(positions: GPS51Position[]): Promise<void> {
    try {
      const positionRecords = positions.map(pos => ({
        device_id: pos.deviceid,
        latitude: pos.callat,
        longitude: pos.callon,
        speed: pos.speed || 0,
        heading: pos.course || 0,
        altitude: pos.altitude || 0,
        timestamp: new Date(pos.updatetime).toISOString(),
        raw_data: pos as any,
        status: pos.moving ? 'moving' : 'stationary'
      }));

      const { error } = await supabase
        .from('vehicle_positions')
        .insert(positionRecords);

      if (error) {
        console.error('GPS51IntelligentOrchestrator: Failed to store positions:', error);
      } else {
        console.log('GPS51IntelligentOrchestrator: Stored positions', {
          count: positionRecords.length
        });
      }
    } catch (error) {
      console.error('GPS51IntelligentOrchestrator: Position processing failed:', error);
    }
  }

  /**
   * Broadcast position updates via WebSocket
   */
  private broadcastPositionUpdates(positions: GPS51Position[]): void {
    // This would integrate with the WebSocket system
    for (const position of positions) {
      window.dispatchEvent(new CustomEvent('gps51-position-update', {
        detail: { deviceId: position.deviceid, position }
      }));
    }
  }

  /**
   * Get recommended polling interval based on current load
   */
  private getRecommendedPollingInterval(): number {
    const riskLevel = this.calculateRiskLevel();
    const activeVehicles = this.orchestratorMetrics.activePollingVehicles;
    
    // Adjust base interval based on risk and load
    let recommendedInterval = 30000; // 30 seconds base
    
    if (riskLevel === 'high' || activeVehicles > 100) {
      recommendedInterval = 60000; // 1 minute for high risk
    } else if (riskLevel === 'medium' || activeVehicles > 50) {
      recommendedInterval = 45000; // 45 seconds for medium risk
    } else if (activeVehicles < 10) {
      recommendedInterval = 20000; // 20 seconds for low load
    }

    return recommendedInterval;
  }

  /**
   * Calculate current risk level
   */
  private calculateRiskLevel(): 'low' | 'medium' | 'high' {
    const metrics = this.orchestratorMetrics;
    
    if (metrics.callsPerMinute > 60 || metrics.successRate < 90) {
      return 'high';
    } else if (metrics.callsPerMinute > 30 || metrics.successRate < 95) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Initialize API rate monitoring
   */
  private initializeRateMonitoring(): void {
    // Track API calls per minute
    setInterval(() => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      // This would be enhanced with actual call tracking
      this.orchestratorMetrics.riskLevel = this.calculateRiskLevel();
      
      console.log('GPS51IntelligentOrchestrator: Rate monitoring update', {
        callsPerMinute: this.orchestratorMetrics.callsPerMinute,
        riskLevel: this.orchestratorMetrics.riskLevel,
        activeVehicles: this.orchestratorMetrics.activePollingVehicles
      });
    }, 60000); // Every minute
  }

  /**
   * Update orchestrator metrics
   */
  private updateMetrics(responseTime: number, success: boolean): void {
    this.orchestratorMetrics.totalApiCalls++;
    this.orchestratorMetrics.lastApiCall = new Date();
    
    if (success) {
      // Update average response time
      const total = this.orchestratorMetrics.totalApiCalls;
      this.orchestratorMetrics.averageResponseTime = 
        ((this.orchestratorMetrics.averageResponseTime * (total - 1)) + responseTime) / total;
    }

    // Update circuit breaker status from adaptive polling service
    const pollingMetrics = this.adaptivePollingService.getPollingMetrics();
    this.orchestratorMetrics.circuitBreakerStatus = pollingMetrics.circuitState;
    this.orchestratorMetrics.successRate = this.adaptivePollingService.getSuccessRate();
  }

  /**
   * Clear user activity profiles (cleanup)
   */
  private clearUserActivityProfiles(): void {
    this.userActivityProfiles.clear();
    this.updateVehicleStrategies();
  }

  /**
   * Get orchestrator metrics
   */
  getOrchestratorMetrics(): OrchestratorMetrics {
    return { ...this.orchestratorMetrics };
  }

  /**
   * Get vehicle strategies (for debugging)
   */
  getVehicleStrategies(): Map<string, VehiclePollingStrategy> {
    return new Map(this.vehicleStrategies);
  }

  /**
   * Force immediate polling for specific vehicles
   */
  async forceVehicleUpdate(deviceIds: string[]): Promise<void> {
    console.log('GPS51IntelligentOrchestrator: Force update requested', { deviceIds });
    await this.executeBatchPolling(deviceIds, 'immediate');
  }
}

// Export singleton instance
export const gps51IntelligentOrchestrator = GPS51IntelligentOrchestrator.getInstance();