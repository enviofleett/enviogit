import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from './types';

// ===== UNIFIED POLLING INTERFACES =====

interface AdaptivePollingConfig {
  baseInterval: number;
  minInterval: number;
  maxInterval: number;
  adaptationFactor: number;
  activityThreshold: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  openUntil: number | null;
}

interface SmartAnalytics {
  pollingHistory: Array<{
    timestamp: number;
    hasData: boolean;
    deviceCount: number;
    responseTime: number;
  }>;
  deviceActivityMap: Map<string, {
    lastActiveTime: number;
    isMoving: boolean;
    pollingPriority: 'high' | 'medium' | 'low';
  }>;
  efficiencyMetrics: {
    pollingEfficiency: number;
    dataUtilization: number;
    adaptationSuccessRate: number;
  };
}

interface UserActivityProfile {
  userId: string;
  activeVehicleIds: Set<string>;
  lastActivity: Date;
  isViewingRealTime: boolean;
  preferredPollingInterval: number;
}

interface VehiclePollingStrategy {
  deviceId: string;
  isMoving: boolean;
  hasActiveUsers: boolean;
  lastPosition?: GPS51Position;
  currentInterval: number;
  priority: 'high' | 'medium' | 'low';
}

interface IntelligentOrchestrator {
  userActivityProfiles: Map<string, UserActivityProfile>;
  vehicleStrategies: Map<string, VehiclePollingStrategy>;
  priorityQueue: Array<{ deviceIds: string[]; priority: number }>;
  orchestrationMetrics: {
    totalApiCalls: number;
    callsPerMinute: number;
    activePollingVehicles: number;
    circuitBreakerStatus: 'closed' | 'open' | 'half-open';
    averageResponseTime: number;
    successRate: number;
    lastApiCall: Date | null;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface UnifiedPollingMetrics {
  // Basic polling metrics
  totalSessions: number;
  activeSessions: number;
  requestsQueued: number;
  requestsCompleted: number;
  averageResponseTime: number;
  lastActivity: Date | null;
  
  // Advanced metrics
  adaptiveMetrics: {
    currentBaseInterval: number;
    adaptationCount: number;
    efficiencyScore: number;
  };
  circuitBreakerMetrics: {
    state: 'closed' | 'open' | 'half-open';
    totalFailures: number;
    recoveryAttempts: number;
  };
  intelligentOrchestration: {
    activeUsers: number;
    prioritizedVehicles: number;
    backgroundVehicles: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

interface PollingSession {
  id: string;
  deviceIds: string[];
  interval: number;
  priority: 'high' | 'normal' | 'low';
  lastQueryTime: number;
  active: boolean;
  callback: (data: { devices: GPS51Device[]; positions: GPS51Position[]; lastQueryTime: number }) => void;
}

interface PollingHierarchy {
  focused: PollingSession[];     // 10-15 second intervals
  active: PollingSession[];      // 30-60 second intervals  
  background: PollingSession[];  // 1-5 minute intervals
}

export class GPS51MasterPollingService {
  private static instance: GPS51MasterPollingService;
  private sessions: Map<string, PollingSession> = new Map();
  private hierarchy: PollingHierarchy = {
    focused: [],
    active: [],
    background: []
  };
  private masterTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastDevicesFetch = 0;
  private cachedDevices: GPS51Device[] = [];

  // ===== UNIFIED POLLING FEATURES =====
  private adaptiveConfig: AdaptivePollingConfig;
  private circuitBreaker: CircuitBreakerState;
  private smartAnalytics: SmartAnalytics;
  private intelligentOrchestrator: IntelligentOrchestrator;
  private unifiedMetrics: UnifiedPollingMetrics;
  private adaptationTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Initialize unified polling features
    this.adaptiveConfig = {
      baseInterval: 30000,
      minInterval: 5000,
      maxInterval: 300000,
      adaptationFactor: 2.0,
      activityThreshold: 30 * 60 * 1000, // 30 minutes
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5
    };

    this.circuitBreaker = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      openUntil: null
    };

    this.smartAnalytics = {
      pollingHistory: [],
      deviceActivityMap: new Map(),
      efficiencyMetrics: {
        pollingEfficiency: 100,
        dataUtilization: 100,
        adaptationSuccessRate: 100
      }
    };

    this.intelligentOrchestrator = {
      userActivityProfiles: new Map(),
      vehicleStrategies: new Map(),
      priorityQueue: [],
      orchestrationMetrics: {
        totalApiCalls: 0,
        callsPerMinute: 0,
        activePollingVehicles: 0,
        circuitBreakerStatus: 'closed',
        averageResponseTime: 0,
        successRate: 100,
        lastApiCall: null,
        riskLevel: 'low'
      }
    };

    this.unifiedMetrics = {
      totalSessions: 0,
      activeSessions: 0,
      requestsQueued: 0,
      requestsCompleted: 0,
      averageResponseTime: 0,
      lastActivity: null,
      adaptiveMetrics: {
        currentBaseInterval: this.adaptiveConfig.baseInterval,
        adaptationCount: 0,
        efficiencyScore: 100
      },
      circuitBreakerMetrics: {
        state: 'closed',
        totalFailures: 0,
        recoveryAttempts: 0
      },
      intelligentOrchestration: {
        activeUsers: 0,
        prioritizedVehicles: 0,
        backgroundVehicles: 0,
        riskLevel: 'low'
      }
    };

    console.log('GPS51MasterPollingService: Initialized with unified polling architecture');
    this.startAdaptationEngine();
  }

  static getInstance(): GPS51MasterPollingService {
    if (!GPS51MasterPollingService.instance) {
      GPS51MasterPollingService.instance = new GPS51MasterPollingService();
    }
    return GPS51MasterPollingService.instance;
  }

  /**
   * Register a new polling session
   */
  registerSession(
    sessionId: string,
    deviceIds: string[],
    interval: number,
    callback: (data: { devices: GPS51Device[]; positions: GPS51Position[]; lastQueryTime: number }) => void,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    console.log('GPS51MasterPollingService: Registering session:', {
      sessionId,
      deviceCount: deviceIds.length,
      interval,
      priority
    });

    const session: PollingSession = {
      id: sessionId,
      deviceIds,
      interval,
      priority,
      lastQueryTime: 0,
      active: true,
      callback
    };

    this.sessions.set(sessionId, session);
    this.updateHierarchy();
    
    if (!this.isPolling) {
      this.startMasterPolling();
    }
  }

  /**
   * Unregister a polling session
   */
  unregisterSession(sessionId: string): void {
    console.log('GPS51MasterPollingService: Unregistering session:', sessionId);
    
    this.sessions.delete(sessionId);
    this.updateHierarchy();

    if (this.sessions.size === 0) {
      this.stopMasterPolling();
    }
  }

  /**
   * Update session priority or interval
   */
  updateSession(
    sessionId: string, 
    updates: Partial<Pick<PollingSession, 'interval' | 'priority' | 'deviceIds'>>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('GPS51MasterPollingService: Session not found:', sessionId);
      return;
    }

    if (updates.interval) session.interval = updates.interval;
    if (updates.priority) session.priority = updates.priority;
    if (updates.deviceIds) session.deviceIds = updates.deviceIds;

    this.updateHierarchy();
    console.log('GPS51MasterPollingService: Updated session:', sessionId, updates);
  }

  /**
   * Update polling hierarchy based on current sessions
   */
  private updateHierarchy(): void {
    this.hierarchy = {
      focused: [],
      active: [],
      background: []
    };

    for (const session of this.sessions.values()) {
      if (!session.active) continue;

      if (session.interval <= 15000 || session.priority === 'high') {
        this.hierarchy.focused.push(session);
      } else if (session.interval <= 60000) {
        this.hierarchy.active.push(session);
      } else {
        this.hierarchy.background.push(session);
      }
    }

    console.log('GPS51MasterPollingService: Updated hierarchy:', {
      focused: this.hierarchy.focused.length,
      active: this.hierarchy.active.length,
      background: this.hierarchy.background.length
    });
  }

  /**
   * Start the master polling loop
   */
  private startMasterPolling(): void {
    if (this.isPolling) return;

    console.log('GPS51MasterPollingService: Starting master polling');
    this.isPolling = true;
    this.schedulePoll();
  }

  /**
   * Stop the master polling loop
   */
  private stopMasterPolling(): void {
    console.log('GPS51MasterPollingService: Stopping master polling');
    this.isPolling = false;
    
    if (this.masterTimer) {
      clearTimeout(this.masterTimer);
      this.masterTimer = null;
    }
  }

  /**
   * Schedule the next poll based on hierarchy
   */
  private schedulePoll(): void {
    if (!this.isPolling) return;

    // Determine next poll interval based on hierarchy
    let nextInterval = 300000; // 5 minutes default

    if (this.hierarchy.focused.length > 0) {
      nextInterval = Math.min(nextInterval, 10000); // 10 seconds for focused
    }
    if (this.hierarchy.active.length > 0) {
      nextInterval = Math.min(nextInterval, 30000); // 30 seconds for active
    }
    if (this.hierarchy.background.length > 0) {
      nextInterval = Math.min(nextInterval, 60000); // 1 minute for background
    }

    this.masterTimer = setTimeout(() => {
      this.executePoll();
    }, nextInterval);

    console.log('GPS51MasterPollingService: Next poll scheduled in', nextInterval + 'ms');
  }

  /**
   * Execute a polling cycle with unified intelligence
   */
  private async executePoll(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51MasterPollingService: Executing intelligent poll cycle');

      // Check circuit breaker
      if (this.circuitBreaker.state === 'open') {
        console.log('GPS51MasterPollingService: Circuit breaker open, skipping poll');
        this.schedulePoll();
        return;
      }

      // First, refresh devices list if needed (every 5 minutes)
      const now = Date.now();
      if (now - this.lastDevicesFetch > 300000) { // 5 minutes
        try {
          this.cachedDevices = await gps51CoordinatorClient.getDeviceList();
          this.lastDevicesFetch = now;
          console.log('GPS51MasterPollingService: Refreshed devices list:', this.cachedDevices.length);
          
          // Update device activity map
          this.cachedDevices.forEach(device => {
            const activity = this.smartAnalytics.deviceActivityMap.get(device.deviceid);
            if (!activity) {
              this.smartAnalytics.deviceActivityMap.set(device.deviceid, {
                lastActiveTime: device.lastactivetime || 0,
                isMoving: false,
                pollingPriority: 'low'
              });
            } else {
              activity.lastActiveTime = device.lastactivetime || activity.lastActiveTime;
            }
          });
        } catch (error) {
          console.warn('GPS51MasterPollingService: Failed to refresh devices:', error);
        }
      }

      // Group sessions by their polling requirements
      const sessionsToPoll = this.getSessionsToPoll();
      
      if (sessionsToPoll.length === 0) {
        this.schedulePoll();
        return;
      }

      // Collect all unique device IDs from sessions that need polling
      const allDeviceIds = new Set<string>();
      sessionsToPoll.forEach(session => {
        session.deviceIds.forEach(id => allDeviceIds.add(id));
      });

      // Get the minimum lastQueryTime from all sessions
      const minLastQueryTime = Math.min(...sessionsToPoll.map(s => s.lastQueryTime));

      console.log('GPS51MasterPollingService: Intelligent polling for', allDeviceIds.size, 'devices');

      // Fetch positions for all devices in one coordinated request
      const { positions, lastQueryTime } = await gps51CoordinatorClient.getRealtimePositions(
        Array.from(allDeviceIds),
        minLastQueryTime
      );

      // Update device activity based on new position data
      positions.forEach(position => {
        const activity = this.smartAnalytics.deviceActivityMap.get(position.deviceid);
        if (activity) {
          activity.isMoving = position.moving === 1;
          activity.lastActiveTime = new Date(position.updatetime).getTime();
        }

        // Update vehicle strategies
        const strategy = this.intelligentOrchestrator.vehicleStrategies.get(position.deviceid);
        if (strategy) {
          strategy.isMoving = position.moving === 1;
          strategy.lastPosition = position;
        }
      });

      // Update session query times and dispatch data
      for (const session of sessionsToPoll) {
        session.lastQueryTime = lastQueryTime;
        
        // Filter data for this session's devices
        const sessionPositions = positions.filter(p => 
          session.deviceIds.includes(p.deviceid)
        );

        // Call session callback with filtered data
        try {
          session.callback({
            devices: this.cachedDevices,
            positions: sessionPositions,
            lastQueryTime
          });
        } catch (error) {
          console.error('GPS51MasterPollingService: Session callback error:', error);
        }
      }

      const responseTime = Date.now() - startTime;
      this.recordPollingResult(true, responseTime, positions.length > 0, allDeviceIds.size);

      console.log('GPS51MasterPollingService: Intelligent poll cycle completed', {
        sessions: sessionsToPoll.length,
        positions: positions.length,
        responseTime,
        efficiency: this.smartAnalytics.efficiencyMetrics.pollingEfficiency
      });

    } catch (error) {
      console.error('GPS51MasterPollingService: Poll cycle failed:', error);
      const responseTime = Date.now() - startTime;
      this.recordPollingResult(false, responseTime, false, 0);
    } finally {
      // Schedule next poll
      this.schedulePoll();
    }
  }

  /**
   * Determine which sessions need polling based on their intervals
   */
  private getSessionsToPoll(): PollingSession[] {
    const now = Date.now();
    const sessionsToPoll: PollingSession[] = [];

    for (const session of this.sessions.values()) {
      if (!session.active) continue;

      const timeSinceLastPoll = now - session.lastQueryTime;
      if (timeSinceLastPoll >= session.interval) {
        sessionsToPoll.push(session);
      }
    }

    return sessionsToPoll;
  }

  /**
   * Force immediate poll for specific session
   */
  async forcePoll(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    console.log('GPS51MasterPollingService: Force polling session:', sessionId);

    try {
      // Get fresh data for this session
      const { positions, lastQueryTime } = await gps51CoordinatorClient.getRealtimePositions(
        session.deviceIds,
        session.lastQueryTime
      );

      session.lastQueryTime = lastQueryTime;

      // Dispatch to session callback
      session.callback({
        devices: this.cachedDevices,
        positions,
        lastQueryTime
      });

    } catch (error) {
      console.error('GPS51MasterPollingService: Force poll failed:', error);
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isPolling: boolean;
    sessionCount: number;
    hierarchy: {
      focused: number;
      active: number;
      background: number;
    };
    lastDevicesFetch: number;
    cachedDevicesCount: number;
  } {
    return {
      isPolling: this.isPolling,
      sessionCount: this.sessions.size,
      hierarchy: {
        focused: this.hierarchy.focused.length,
        active: this.hierarchy.active.length,
        background: this.hierarchy.background.length
      },
      lastDevicesFetch: this.lastDevicesFetch,
      cachedDevicesCount: this.cachedDevices.length
    };
  }

  // ===== UNIFIED POLLING FEATURES =====

  /**
   * Start the adaptive engine for intelligent interval optimization
   */
  private startAdaptationEngine(): void {
    if (this.adaptationTimer) return;

    this.adaptationTimer = setInterval(() => {
      this.runAdaptiveAnalysis();
      this.updateIntelligentStrategies();
      this.optimizePollingIntervals();
    }, 60000); // Run every minute

    console.log('GPS51MasterPollingService: Adaptive engine started');
  }

  /**
   * Run adaptive analysis on polling efficiency
   */
  private runAdaptiveAnalysis(): void {
    // Analyze recent polling history
    const recentHistory = this.smartAnalytics.pollingHistory.slice(-20);
    if (recentHistory.length === 0) return;

    const emptyPolls = recentHistory.filter(h => !h.hasData).length;
    const avgResponseTime = recentHistory.reduce((sum, h) => sum + h.responseTime, 0) / recentHistory.length;
    
    // Calculate efficiency metrics
    this.smartAnalytics.efficiencyMetrics.pollingEfficiency = Math.max(0, 100 - (emptyPolls * 5));
    this.smartAnalytics.efficiencyMetrics.dataUtilization = recentHistory.length > 0 ? 
      ((recentHistory.length - emptyPolls) / recentHistory.length) * 100 : 100;

    // Update adaptive config based on efficiency
    if (this.smartAnalytics.efficiencyMetrics.pollingEfficiency < 70) {
      this.adaptiveConfig.baseInterval = Math.min(
        this.adaptiveConfig.baseInterval * 1.2,
        this.adaptiveConfig.maxInterval
      );
      this.unifiedMetrics.adaptiveMetrics.adaptationCount++;
    } else if (this.smartAnalytics.efficiencyMetrics.pollingEfficiency > 90) {
      this.adaptiveConfig.baseInterval = Math.max(
        this.adaptiveConfig.baseInterval * 0.9,
        this.adaptiveConfig.minInterval
      );
      this.unifiedMetrics.adaptiveMetrics.adaptationCount++;
    }

    this.unifiedMetrics.adaptiveMetrics.currentBaseInterval = this.adaptiveConfig.baseInterval;
    this.unifiedMetrics.adaptiveMetrics.efficiencyScore = this.smartAnalytics.efficiencyMetrics.pollingEfficiency;

    console.log('GPS51MasterPollingService: Adaptive analysis completed', {
      efficiency: this.smartAnalytics.efficiencyMetrics.pollingEfficiency,
      newBaseInterval: this.adaptiveConfig.baseInterval,
      avgResponseTime
    });
  }

  /**
   * Update intelligent orchestration strategies
   */
  private updateIntelligentStrategies(): void {
    // Update vehicle strategies based on recent activity
    for (const [deviceId, activity] of this.smartAnalytics.deviceActivityMap) {
      const timeSinceActive = Date.now() - activity.lastActiveTime;
      const strategy = this.intelligentOrchestrator.vehicleStrategies.get(deviceId);

      if (strategy) {
        // Update priority based on activity and user interest
        if (timeSinceActive < this.adaptiveConfig.activityThreshold && activity.isMoving) {
          strategy.priority = 'high';
          strategy.currentInterval = this.adaptiveConfig.minInterval;
        } else if (strategy.hasActiveUsers) {
          strategy.priority = 'medium';
          strategy.currentInterval = this.adaptiveConfig.baseInterval;
        } else {
          strategy.priority = 'low';
          strategy.currentInterval = this.adaptiveConfig.maxInterval;
        }
      }
    }

    // Update orchestration metrics
    const strategies = Array.from(this.intelligentOrchestrator.vehicleStrategies.values());
    this.intelligentOrchestrator.orchestrationMetrics.activePollingVehicles = 
      strategies.filter(s => s.priority !== 'low').length;

    this.unifiedMetrics.intelligentOrchestration.prioritizedVehicles = 
      strategies.filter(s => s.priority === 'high').length;
    this.unifiedMetrics.intelligentOrchestration.backgroundVehicles = 
      strategies.filter(s => s.priority === 'low').length;
  }

  /**
   * Optimize polling intervals based on unified analysis
   */
  private optimizePollingIntervals(): void {
    // Check circuit breaker state
    if (this.circuitBreaker.state === 'open') {
      if (this.circuitBreaker.openUntil && Date.now() > this.circuitBreaker.openUntil) {
        this.circuitBreaker.state = 'half-open';
        console.log('GPS51MasterPollingService: Circuit breaker moved to half-open');
      } else {
        return; // Skip optimization while circuit is open
      }
    }

    // Calculate risk level
    const failureRate = this.circuitBreaker.failureCount / 
      Math.max(1, this.circuitBreaker.failureCount + this.circuitBreaker.successCount);
    
    if (failureRate > 0.2) {
      this.intelligentOrchestrator.orchestrationMetrics.riskLevel = 'high';
    } else if (failureRate > 0.1) {
      this.intelligentOrchestrator.orchestrationMetrics.riskLevel = 'medium';
    } else {
      this.intelligentOrchestrator.orchestrationMetrics.riskLevel = 'low';
    }

    this.unifiedMetrics.intelligentOrchestration.riskLevel = 
      this.intelligentOrchestrator.orchestrationMetrics.riskLevel;

    // Apply risk-based interval adjustments to sessions
    const riskMultiplier = {
      'low': 1.0,
      'medium': 1.3,
      'high': 2.0
    }[this.intelligentOrchestrator.orchestrationMetrics.riskLevel];

    for (const session of this.sessions.values()) {
      if (session.priority === 'high') continue; // Don't modify high-priority sessions
      
      const baseInterval = session.priority === 'normal' ? 
        this.adaptiveConfig.baseInterval : this.adaptiveConfig.maxInterval;
      
      session.interval = Math.min(
        baseInterval * riskMultiplier,
        this.adaptiveConfig.maxInterval
      );
    }
  }

  /**
   * Register user activity for intelligent polling
   */
  registerUserActivity(
    userId: string, 
    vehicleIds: string[], 
    isViewingRealTime = false
  ): void {
    const profile: UserActivityProfile = {
      userId,
      activeVehicleIds: new Set(vehicleIds),
      lastActivity: new Date(),
      isViewingRealTime,
      preferredPollingInterval: isViewingRealTime ? 10000 : 30000
    };

    this.intelligentOrchestrator.userActivityProfiles.set(userId, profile);
    
    // Update vehicle strategies for this user's vehicles
    vehicleIds.forEach(deviceId => {
      let strategy = this.intelligentOrchestrator.vehicleStrategies.get(deviceId);
      if (!strategy) {
        strategy = {
          deviceId,
          isMoving: false,
          hasActiveUsers: true,
          currentInterval: profile.preferredPollingInterval,
          priority: isViewingRealTime ? 'high' : 'medium'
        };
        this.intelligentOrchestrator.vehicleStrategies.set(deviceId, strategy);
      } else {
        strategy.hasActiveUsers = true;
        if (isViewingRealTime) {
          strategy.priority = 'high';
          strategy.currentInterval = 10000;
        }
      }
    });

    this.unifiedMetrics.intelligentOrchestration.activeUsers = 
      this.intelligentOrchestrator.userActivityProfiles.size;

    console.log('GPS51MasterPollingService: User activity registered', {
      userId,
      vehicleCount: vehicleIds.length,
      isViewingRealTime,
      totalActiveUsers: this.intelligentOrchestrator.userActivityProfiles.size
    });
  }

  /**
   * Unregister user activity
   */
  unregisterUserActivity(userId: string): void {
    const profile = this.intelligentOrchestrator.userActivityProfiles.get(userId);
    if (!profile) return;

    // Update vehicle strategies
    profile.activeVehicleIds.forEach(deviceId => {
      const strategy = this.intelligentOrchestrator.vehicleStrategies.get(deviceId);
      if (strategy) {
        strategy.hasActiveUsers = false;
        strategy.priority = strategy.isMoving ? 'medium' : 'low';
        strategy.currentInterval = strategy.isMoving ? 
          this.adaptiveConfig.baseInterval : this.adaptiveConfig.maxInterval;
      }
    });

    this.intelligentOrchestrator.userActivityProfiles.delete(userId);
    this.unifiedMetrics.intelligentOrchestration.activeUsers = 
      this.intelligentOrchestrator.userActivityProfiles.size;

    console.log('GPS51MasterPollingService: User activity unregistered', { userId });
  }

  /**
   * Record polling operation result for circuit breaker and analytics
   */
  private recordPollingResult(success: boolean, responseTime: number, hasData: boolean, deviceCount: number): void {
    this.smartAnalytics.pollingHistory.push({
      timestamp: Date.now(),
      hasData,
      deviceCount,
      responseTime
    });

    // Keep only recent history
    if (this.smartAnalytics.pollingHistory.length > 100) {
      this.smartAnalytics.pollingHistory = this.smartAnalytics.pollingHistory.slice(-100);
    }

    // Update circuit breaker
    if (success) {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.state === 'half-open') {
        this.circuitBreaker.state = 'closed';
        console.log('GPS51MasterPollingService: Circuit breaker closed');
      }
    } else {
      this.circuitBreaker.failureCount++;
      this.circuitBreaker.lastFailureTime = Date.now();

      if (this.circuitBreaker.failureCount >= this.adaptiveConfig.circuitBreakerThreshold) {
        this.circuitBreaker.state = 'open';
        this.circuitBreaker.openUntil = Date.now() + 60000; // Open for 1 minute
        this.unifiedMetrics.circuitBreakerMetrics.totalFailures++;
        console.warn('GPS51MasterPollingService: Circuit breaker opened');
      }
    }

    // Update unified metrics
    this.unifiedMetrics.requestsCompleted++;
    this.unifiedMetrics.averageResponseTime = 
      ((this.unifiedMetrics.averageResponseTime * (this.unifiedMetrics.requestsCompleted - 1)) + responseTime) / 
      this.unifiedMetrics.requestsCompleted;
    this.unifiedMetrics.lastActivity = new Date();
    this.unifiedMetrics.circuitBreakerMetrics.state = this.circuitBreaker.state;

    this.intelligentOrchestrator.orchestrationMetrics.totalApiCalls++;
    this.intelligentOrchestrator.orchestrationMetrics.averageResponseTime = this.unifiedMetrics.averageResponseTime;
    this.intelligentOrchestrator.orchestrationMetrics.lastApiCall = new Date();
    this.intelligentOrchestrator.orchestrationMetrics.circuitBreakerStatus = this.circuitBreaker.state;
  }

  /**
   * Get comprehensive unified metrics
   */
  getUnifiedMetrics(): UnifiedPollingMetrics & {
    adaptiveConfig: AdaptivePollingConfig;
    circuitBreakerState: CircuitBreakerState;
    orchestrationMetrics: typeof this.intelligentOrchestrator.orchestrationMetrics;
  } {
    return {
      ...this.unifiedMetrics,
      adaptiveConfig: this.adaptiveConfig,
      circuitBreakerState: this.circuitBreaker,
      orchestrationMetrics: this.intelligentOrchestrator.orchestrationMetrics
    };
  }

  /**
   * Emergency stop - clear all sessions and stop polling
   */
  emergencyStop(): void {
    console.log('GPS51MasterPollingService: Emergency stop activated');
    
    this.sessions.clear();
    this.hierarchy = { focused: [], active: [], background: [] };
    this.stopMasterPolling();
    
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
    
    gps51CoordinatorClient.clearAllRequests();
  }
}

export const gps51MasterPollingService = GPS51MasterPollingService.getInstance();