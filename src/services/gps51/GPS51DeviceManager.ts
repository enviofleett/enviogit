import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51Device } from './types';

export interface DeviceMetadata {
  deviceId: string;
  lastSeen: Date;
  connectivityPattern: {
    avgResponseTime: number;
    uptimePercentage: number;
    lastOnlineTime: Date;
    offlineDuration: number;
    connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  };
  activityMetrics: {
    movingTimeToday: number;
    idleTimeToday: number;
    totalDistanceToday: number;
    averageSpeed: number;
    lastMovementTime: Date;
  };
  alertStatus: {
    isInactive: boolean;
    isOffline: boolean;
    needsAttention: boolean;
    lastAlertTime: Date | null;
  };
}

export interface DeviceAlert {
  deviceId: string;
  deviceName: string;
  alertType: 'inactive' | 'offline' | 'poor_connectivity' | 'low_battery';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface FleetChangeEvent {
  type: 'device_added' | 'device_removed' | 'device_modified';
  deviceId: string;
  deviceName?: string;
  timestamp: Date;
  previousState?: Partial<GPS51Device>;
  newState?: Partial<GPS51Device>;
}

export class GPS51DeviceManager {
  private static instance: GPS51DeviceManager;
  private client: GPS51Client;
  private deviceMetadata = new Map<string, DeviceMetadata>();
  private deviceAlerts: DeviceAlert[] = [];
  private fleetChangeHistory: FleetChangeEvent[] = [];
  private lastDeviceListRefresh: Date | null = null;
  private deviceListRefreshTimer: NodeJS.Timeout | null = null;
  private refreshInterval = 60 * 60 * 1000; // 1 hour default
  private lastKnownDeviceList: GPS51Device[] = [];

  private constructor(client: GPS51Client = gps51Client) {
    this.client = client;
  }

  static getInstance(): GPS51DeviceManager {
    if (!GPS51DeviceManager.instance) {
      GPS51DeviceManager.instance = new GPS51DeviceManager();
    }
    return GPS51DeviceManager.instance;
  }

  /**
   * Start periodic device list refresh to detect fleet changes
   */
  startDeviceListMonitoring(intervalMs: number = this.refreshInterval): void {
    console.log('GPS51DeviceManager: Starting device list monitoring', { intervalMs });
    
    this.refreshInterval = intervalMs;
    
    // Stop existing timer
    if (this.deviceListRefreshTimer) {
      clearInterval(this.deviceListRefreshTimer);
    }

    // Initial refresh
    this.refreshDeviceList();

    // Setup periodic refresh
    this.deviceListRefreshTimer = setInterval(() => {
      this.refreshDeviceList();
    }, intervalMs);
  }

  /**
   * Stop device list monitoring
   */
  stopDeviceListMonitoring(): void {
    if (this.deviceListRefreshTimer) {
      clearInterval(this.deviceListRefreshTimer);
      this.deviceListRefreshTimer = null;
    }
    console.log('GPS51DeviceManager: Device list monitoring stopped');
  }

  /**
   * Refresh device list and detect changes
   */
  async refreshDeviceList(): Promise<FleetChangeEvent[]> {
    try {
      console.log('GPS51DeviceManager: Refreshing device list...');
      
      const currentDevices = await this.client.getDeviceList();
      const changes = this.detectFleetChanges(this.lastKnownDeviceList, currentDevices);
      
      // Update metadata for all devices
      for (const device of currentDevices) {
        this.updateDeviceMetadata(device);
      }

      // Log changes
      if (changes.length > 0) {
        console.log('GPS51DeviceManager: Fleet changes detected:', {
          changeCount: changes.length,
          changes: changes.map(c => ({ type: c.type, deviceId: c.deviceId, deviceName: c.deviceName }))
        });
        
        this.fleetChangeHistory.push(...changes);
        
        // Keep only last 100 changes
        if (this.fleetChangeHistory.length > 100) {
          this.fleetChangeHistory = this.fleetChangeHistory.slice(-100);
        }
      }

      this.lastKnownDeviceList = currentDevices;
      this.lastDeviceListRefresh = new Date();
      
      return changes;
    } catch (error) {
      console.error('GPS51DeviceManager: Failed to refresh device list:', error);
      return [];
    }
  }

  /**
   * Detect changes between old and new device lists
   */
  private detectFleetChanges(oldDevices: GPS51Device[], newDevices: GPS51Device[]): FleetChangeEvent[] {
    const changes: FleetChangeEvent[] = [];
    const oldDeviceMap = new Map(oldDevices.map(d => [d.deviceid, d]));
    const newDeviceMap = new Map(newDevices.map(d => [d.deviceid, d]));

    // Detect removed devices
    for (const [deviceId, oldDevice] of oldDeviceMap) {
      if (!newDeviceMap.has(deviceId)) {
        changes.push({
          type: 'device_removed',
          deviceId,
          deviceName: oldDevice.devicename,
          timestamp: new Date(),
          previousState: oldDevice
        });
      }
    }

    // Detect added and modified devices
    for (const [deviceId, newDevice] of newDeviceMap) {
      const oldDevice = oldDeviceMap.get(deviceId);
      
      if (!oldDevice) {
        // New device
        changes.push({
          type: 'device_added',
          deviceId,
          deviceName: newDevice.devicename,
          timestamp: new Date(),
          newState: newDevice
        });
      } else {
        // Check for modifications (device name, type, etc.)
        if (this.hasDeviceChanged(oldDevice, newDevice)) {
          changes.push({
            type: 'device_modified',
            deviceId,
            deviceName: newDevice.devicename,
            timestamp: new Date(),
            previousState: oldDevice,
            newState: newDevice
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if a device has meaningful changes
   */
  private hasDeviceChanged(oldDevice: GPS51Device, newDevice: GPS51Device): boolean {
    return (
      oldDevice.devicename !== newDevice.devicename ||
      oldDevice.devicetype !== newDevice.devicetype ||
      oldDevice.isfree !== newDevice.isfree ||
      oldDevice.simnum !== newDevice.simnum
    );
  }

  /**
   * Update device metadata and connectivity patterns
   */
  updateDeviceMetadata(device: GPS51Device, responseTime?: number): void {
    const deviceId = device.deviceid;
    const now = new Date();
    const existing = this.deviceMetadata.get(deviceId);

    let metadata: DeviceMetadata;
    
    if (existing) {
      // Update existing metadata
      metadata = {
        ...existing,
        deviceId,
        lastSeen: now
      };

      // Update connectivity pattern
      if (responseTime !== undefined) {
        const pattern = metadata.connectivityPattern;
        pattern.avgResponseTime = (pattern.avgResponseTime + responseTime) / 2;
        pattern.lastOnlineTime = now;
        pattern.offlineDuration = 0;
        
        // Update connection quality based on response time
        if (responseTime < 1000) {
          pattern.connectionQuality = 'excellent';
        } else if (responseTime < 3000) {
          pattern.connectionQuality = 'good';
        } else if (responseTime < 10000) {
          pattern.connectionQuality = 'poor';
        } else {
          pattern.connectionQuality = 'critical';
        }
      }
    } else {
      // Create new metadata
      metadata = {
        deviceId,
        lastSeen: now,
        connectivityPattern: {
          avgResponseTime: responseTime || 0,
          uptimePercentage: 100,
          lastOnlineTime: now,
          offlineDuration: 0,
          connectionQuality: 'good'
        },
        activityMetrics: {
          movingTimeToday: 0,
          idleTimeToday: 0,
          totalDistanceToday: 0,
          averageSpeed: 0,
          lastMovementTime: now
        },
        alertStatus: {
          isInactive: false,
          isOffline: false,
          needsAttention: false,
          lastAlertTime: null
        }
      };
    }

    // Check for alerts
    this.checkDeviceAlerts(device, metadata);
    
    this.deviceMetadata.set(deviceId, metadata);
  }

  /**
   * Check and generate alerts for device issues
   */
  private checkDeviceAlerts(device: GPS51Device, metadata: DeviceMetadata): void {
    const now = new Date();
    const deviceId = device.deviceid;
    const deviceName = device.devicename;

    // Check for offline devices (no communication for 30+ minutes)
    const offlineThreshold = 30 * 60 * 1000; // 30 minutes
    const timeSinceLastSeen = now.getTime() - metadata.lastSeen.getTime();
    
    if (timeSinceLastSeen > offlineThreshold && !metadata.alertStatus.isOffline) {
      this.addAlert({
        deviceId,
        deviceName,
        alertType: 'offline',
        severity: 'high',
        message: `Device ${deviceName} has been offline for ${Math.round(timeSinceLastSeen / (60 * 1000))} minutes`,
        timestamp: now,
        acknowledged: false
      });
      metadata.alertStatus.isOffline = true;
      metadata.alertStatus.lastAlertTime = now;
    }

    // Check for inactive devices (no movement for 2+ hours)
    const inactiveThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const timeSinceLastMovement = now.getTime() - metadata.activityMetrics.lastMovementTime.getTime();
    
    if (timeSinceLastMovement > inactiveThreshold && !metadata.alertStatus.isInactive) {
      this.addAlert({
        deviceId,
        deviceName,
        alertType: 'inactive',
        severity: 'medium',
        message: `Device ${deviceName} has been inactive for ${Math.round(timeSinceLastMovement / (60 * 60 * 1000))} hours`,
        timestamp: now,
        acknowledged: false
      });
      metadata.alertStatus.isInactive = true;
      metadata.alertStatus.lastAlertTime = now;
    }

    // Check for poor connectivity
    if (metadata.connectivityPattern.connectionQuality === 'critical' && !metadata.alertStatus.needsAttention) {
      this.addAlert({
        deviceId,
        deviceName,
        alertType: 'poor_connectivity',
        severity: 'medium',
        message: `Device ${deviceName} has poor connectivity (avg response: ${Math.round(metadata.connectivityPattern.avgResponseTime)}ms)`,
        timestamp: now,
        acknowledged: false
      });
      metadata.alertStatus.needsAttention = true;
      metadata.alertStatus.lastAlertTime = now;
    }
  }

  /**
   * Add a new alert
   */
  private addAlert(alert: DeviceAlert): void {
    this.deviceAlerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.deviceAlerts.length > 50) {
      this.deviceAlerts = this.deviceAlerts.slice(0, 50);
    }

    console.log('GPS51DeviceManager: Alert generated:', {
      deviceId: alert.deviceId,
      deviceName: alert.deviceName,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message
    });
  }

  /**
   * Get device metadata
   */
  getDeviceMetadata(deviceId: string): DeviceMetadata | undefined {
    return this.deviceMetadata.get(deviceId);
  }

  /**
   * Get all device metadata
   */
  getAllDeviceMetadata(): Map<string, DeviceMetadata> {
    return new Map(this.deviceMetadata);
  }

  /**
   * Get current alerts
   */
  getActiveAlerts(): DeviceAlert[] {
    return this.deviceAlerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Get all alerts (including acknowledged)
   */
  getAllAlerts(): DeviceAlert[] {
    return [...this.deviceAlerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(deviceId: string, alertType: string): boolean {
    const alert = this.deviceAlerts.find(a => 
      a.deviceId === deviceId && 
      a.alertType === alertType && 
      !a.acknowledged
    );
    
    if (alert) {
      alert.acknowledged = true;
      console.log('GPS51DeviceManager: Alert acknowledged:', { deviceId, alertType });
      return true;
    }
    
    return false;
  }

  /**
   * Get fleet change history
   */
  getFleetChangeHistory(): FleetChangeEvent[] {
    return [...this.fleetChangeHistory];
  }

  /**
   * Get fleet statistics
   */
  getFleetStatistics() {
    const devices = Array.from(this.deviceMetadata.values());
    const now = new Date();
    
    const onlineDevices = devices.filter(d => 
      (now.getTime() - d.lastSeen.getTime()) < 30 * 60 * 1000 // Online within 30 minutes
    );
    
    const activeDevices = devices.filter(d => 
      (now.getTime() - d.activityMetrics.lastMovementTime.getTime()) < 2 * 60 * 60 * 1000 // Active within 2 hours
    );

    const connectivityQuality = {
      excellent: devices.filter(d => d.connectivityPattern.connectionQuality === 'excellent').length,
      good: devices.filter(d => d.connectivityPattern.connectionQuality === 'good').length,
      poor: devices.filter(d => d.connectivityPattern.connectionQuality === 'poor').length,
      critical: devices.filter(d => d.connectivityPattern.connectionQuality === 'critical').length
    };

    return {
      totalDevices: devices.length,
      onlineDevices: onlineDevices.length,
      activeDevices: activeDevices.length,
      offlineDevices: devices.length - onlineDevices.length,
      inactiveDevices: devices.length - activeDevices.length,
      connectivityQuality,
      lastRefresh: this.lastDeviceListRefresh,
      activeAlerts: this.getActiveAlerts().length,
      totalAlerts: this.deviceAlerts.length
    };
  }

  /**
   * Clear old data
   */
  cleanup(): void {
    const now = new Date();
    const oldestAllowed = now.getTime() - (24 * 60 * 60 * 1000); // 24 hours

    // Clean old alerts
    this.deviceAlerts = this.deviceAlerts.filter(alert => 
      alert.timestamp.getTime() > oldestAllowed
    );

    // Clean old fleet changes
    this.fleetChangeHistory = this.fleetChangeHistory.filter(change => 
      change.timestamp.getTime() > oldestAllowed
    );

    console.log('GPS51DeviceManager: Cleanup completed');
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.stopDeviceListMonitoring();
    this.deviceMetadata.clear();
    this.deviceAlerts = [];
    this.fleetChangeHistory = [];
    this.lastDeviceListRefresh = null;
    this.lastKnownDeviceList = [];
    console.log('GPS51DeviceManager: Reset completed');
  }
}

export const gps51DeviceManager = GPS51DeviceManager.getInstance();
