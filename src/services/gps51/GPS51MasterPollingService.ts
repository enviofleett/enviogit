import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { GPS51Device, GPS51Position } from './types';

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
   * Execute a polling cycle
   */
  private async executePoll(): Promise<void> {
    try {
      console.log('GPS51MasterPollingService: Executing poll cycle');

      // First, refresh devices list if needed (every 5 minutes)
      const now = Date.now();
      if (now - this.lastDevicesFetch > 300000) { // 5 minutes
        try {
          this.cachedDevices = await gps51CoordinatorClient.getDeviceList();
          this.lastDevicesFetch = now;
          console.log('GPS51MasterPollingService: Refreshed devices list:', this.cachedDevices.length);
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

      console.log('GPS51MasterPollingService: Polling for', allDeviceIds.size, 'devices');

      // Fetch positions for all devices in one coordinated request
      const { positions, lastQueryTime } = await gps51CoordinatorClient.getRealtimePositions(
        Array.from(allDeviceIds),
        minLastQueryTime
      );

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

      console.log('GPS51MasterPollingService: Poll cycle completed, dispatched to', sessionsToPoll.length, 'sessions');

    } catch (error) {
      console.error('GPS51MasterPollingService: Poll cycle failed:', error);
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

  /**
   * Emergency stop - clear all sessions and stop polling
   */
  emergencyStop(): void {
    console.log('GPS51MasterPollingService: Emergency stop activated');
    
    this.sessions.clear();
    this.hierarchy = { focused: [], active: [], background: [] };
    this.stopMasterPolling();
    gps51CoordinatorClient.clearAllRequests();
  }
}

export const gps51MasterPollingService = GPS51MasterPollingService.getInstance();