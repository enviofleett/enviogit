import { gps51EventBus } from './realtime/GPS51EventBus';
import { gps51UpdateQueue } from './realtime/GPS51UpdateQueue';

export interface AlertRule {
  id: string;
  type: 'speed' | 'geofence' | 'panic' | 'maintenance' | 'battery' | 'temperature' | 'fuel' | 'custom';
  name: string;
  description: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  vehicles: string[]; // Empty array means all vehicles
  throttle: number; // Minimum seconds between alerts of same type for same vehicle
  actions: AlertAction[];
  createdAt: number;
  lastTriggered?: number;
}

export interface AlertCondition {
  field: string;
  operator: '>' | '<' | '=' | '!=' | '>=' | '<=' | 'contains' | 'within' | 'outside';
  value: any;
  duration?: number; // Condition must persist for this duration (ms)
}

export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'log' | 'stop_vehicle' | 'disable_engine';
  config: Record<string, any>;
}

export interface ActiveAlert {
  id: string;
  ruleId: string;
  vehicleId: string;
  vehicleName: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  data: any;
  acknowledged: boolean;
  resolvedAt?: number;
}

export class GPS51RealTimeAlertsManager {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, ActiveAlert>();
  private lastAlertTimes = new Map<string, number>(); // vehicleId:ruleId -> timestamp
  private conditionStates = new Map<string, {
    startTime: number;
    persistent: boolean;
  }>(); // vehicleId:ruleId -> state

  private alertHistory: ActiveAlert[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.setupEventListeners();
    this.initializeDefaultRules();
  }

  private setupEventListeners(): void {
    // Listen for vehicle updates
    gps51EventBus.on('gps51.vehicles.updated', (vehicles: any) => {
      if (Array.isArray(vehicles)) {
        vehicles.forEach((vehicle: any) => {
          this.evaluateVehicleAlerts(vehicle);
        });
      }
    });

    // Listen for position updates
    gps51EventBus.on('gps51.positions.updated', (positions: any) => {
      if (Array.isArray(positions)) {
        positions.forEach((position: any) => {
          this.evaluatePositionAlerts(position);
        });
      }
    });

    // Listen for custom events
    gps51EventBus.on('gps51.vehicle.panic_button', (data: any) => {
      this.handlePanicButton(data);
    });
  }

  private initializeDefaultRules(): void {
    // Speed violation rule
    this.addRule({
      id: 'speed_violation',
      type: 'speed',
      name: 'Speed Violation',
      description: 'Vehicle exceeding speed limit',
      condition: {
        field: 'speed',
        operator: '>',
        value: 80, // km/h
        duration: 10000 // 10 seconds
      },
      severity: 'warning',
      enabled: true,
      vehicles: [],
      throttle: 300, // 5 minutes
      actions: [
        { type: 'notification', config: { priority: 'high' } },
        { type: 'log', config: { level: 'warning' } }
      ],
      createdAt: Date.now()
    });

    // Critical speed violation
    this.addRule({
      id: 'critical_speed_violation',
      type: 'speed',
      name: 'Critical Speed Violation',
      description: 'Vehicle severely exceeding speed limit',
      condition: {
        field: 'speed',
        operator: '>',
        value: 120, // km/h
        duration: 5000 // 5 seconds
      },
      severity: 'critical',
      enabled: true,
      vehicles: [],
      throttle: 180, // 3 minutes
      actions: [
        { type: 'notification', config: { priority: 'critical' } },
        { type: 'email', config: { template: 'speed_violation' } },
        { type: 'log', config: { level: 'error' } }
      ],
      createdAt: Date.now()
    });

    // Low fuel alert
    this.addRule({
      id: 'low_fuel',
      type: 'fuel',
      name: 'Low Fuel Level',
      description: 'Vehicle fuel level is critically low',
      condition: {
        field: 'fuelLevel',
        operator: '<',
        value: 15, // percentage
        duration: 30000 // 30 seconds
      },
      severity: 'warning',
      enabled: true,
      vehicles: [],
      throttle: 3600, // 1 hour
      actions: [
        { type: 'notification', config: { priority: 'medium' } },
        { type: 'log', config: { level: 'warning' } }
      ],
      createdAt: Date.now()
    });

    // Engine temperature alert
    this.addRule({
      id: 'engine_overheating',
      type: 'temperature',
      name: 'Engine Overheating',
      description: 'Engine temperature is critically high',
      condition: {
        field: 'engineTemperature',
        operator: '>',
        value: 105, // Celsius
        duration: 15000 // 15 seconds
      },
      severity: 'critical',
      enabled: true,
      vehicles: [],
      throttle: 300, // 5 minutes
      actions: [
        { type: 'notification', config: { priority: 'critical' } },
        { type: 'email', config: { template: 'engine_overheating' } },
        { type: 'log', config: { level: 'error' } }
      ],
      createdAt: Date.now()
    });

    // Battery low alert
    this.addRule({
      id: 'battery_low',
      type: 'battery',
      name: 'Low Battery Voltage',
      description: 'Vehicle battery voltage is critically low',
      condition: {
        field: 'batteryVoltage',
        operator: '<',
        value: 12.0, // Volts
        duration: 60000 // 1 minute
      },
      severity: 'warning',
      enabled: true,
      vehicles: [],
      throttle: 1800, // 30 minutes
      actions: [
        { type: 'notification', config: { priority: 'medium' } },
        { type: 'log', config: { level: 'warning' } }
      ],
      createdAt: Date.now()
    });

    console.log('GPS51RealTimeAlertsManager: Default alert rules initialized');
  }

  // Rule management
  addRule(rule: Omit<AlertRule, 'id'> & { id?: string }): string {
    const ruleId = rule.id || this.generateRuleId();
    const alertRule: AlertRule = {
      ...rule,
      id: ruleId,
      createdAt: rule.createdAt || Date.now()
    };

    this.rules.set(ruleId, alertRule);
    
    console.log('GPS51RealTimeAlertsManager: Alert rule added:', {
      id: ruleId,
      type: alertRule.type,
      name: alertRule.name
    });

    return ruleId;
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    
    // Clear related state
    this.clearRuleState(ruleId);
    
    if (removed) {
      console.log('GPS51RealTimeAlertsManager: Alert rule removed:', ruleId);
    }
    
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    
    console.log('GPS51RealTimeAlertsManager: Alert rule updated:', ruleId);
    return true;
  }

  // Alert evaluation
  private evaluateVehicleAlerts(vehicle: any): void {
    if (!vehicle.device?.deviceid) return;

    const vehicleId = vehicle.device.deviceid;

    this.rules.forEach(rule => {
      if (!rule.enabled) return;
      if (rule.vehicles.length > 0 && !rule.vehicles.includes(vehicleId)) return;

      this.evaluateRuleForVehicle(rule, vehicleId, vehicle);
    });
  }

  private evaluatePositionAlerts(position: any): void {
    if (!position.deviceid) return;

    // Position-specific rules (geofencing, etc.)
    this.rules.forEach(rule => {
      if (!rule.enabled) return;
      if (rule.vehicles.length > 0 && !rule.vehicles.includes(position.deviceid)) return;

      // Handle geofence rules
      if (rule.type === 'geofence') {
        this.evaluateGeofenceRule(rule, position);
      }
    });
  }

  private evaluateRuleForVehicle(rule: AlertRule, vehicleId: string, data: any): void {
    const conditionMet = this.evaluateCondition(rule.condition, data);
    const stateKey = `${vehicleId}:${rule.id}`;
    
    if (conditionMet) {
      let conditionState = this.conditionStates.get(stateKey);
      
      if (!conditionState) {
        // Start tracking this condition
        conditionState = {
          startTime: Date.now(),
          persistent: false
        };
        this.conditionStates.set(stateKey, conditionState);
      }
      
      // Check if condition has persisted long enough
      const duration = rule.condition.duration || 0;
      const elapsedTime = Date.now() - conditionState.startTime;
      
      if (elapsedTime >= duration && !conditionState.persistent) {
        conditionState.persistent = true;
        this.triggerAlert(rule, vehicleId, data);
      }
    } else {
      // Condition not met, clear state
      const conditionState = this.conditionStates.get(stateKey);
      if (conditionState) {
        this.conditionStates.delete(stateKey);
        
        // Resolve alert if it was active
        this.resolveAlert(vehicleId, rule.id);
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, data: any): boolean {
    const fieldValue = this.getFieldValue(data, condition.field);
    
    if (fieldValue === undefined || fieldValue === null) return false;

    switch (condition.operator) {
      case '>':
        return fieldValue > condition.value;
      case '<':
        return fieldValue < condition.value;
      case '>=':
        return fieldValue >= condition.value;
      case '<=':
        return fieldValue <= condition.value;
      case '=':
        return fieldValue === condition.value;
      case '!=':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      default:
        return false;
    }
  }

  private getFieldValue(data: any, field: string): any {
    // Support dot notation for nested fields
    const fields = field.split('.');
    let value = data;
    
    for (const f of fields) {
      if (value && typeof value === 'object') {
        value = value[f];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private triggerAlert(rule: AlertRule, vehicleId: string, data: any): void {
    // Check throttle
    const throttleKey = `${vehicleId}:${rule.id}`;
    const lastAlertTime = this.lastAlertTimes.get(throttleKey) || 0;
    const timeSinceLastAlert = Date.now() - lastAlertTime;
    
    if (timeSinceLastAlert < rule.throttle * 1000) {
      return; // Throttled
    }

    const alertId = this.generateAlertId();
    const alert: ActiveAlert = {
      id: alertId,
      ruleId: rule.id,
      vehicleId,
      vehicleName: data.device?.devicename || vehicleId,
      type: rule.type,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, data),
      timestamp: Date.now(),
      data: { ...data },
      acknowledged: false
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.unshift(alert);
    
    // Trim history
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }

    this.lastAlertTimes.set(throttleKey, Date.now());

    // Execute alert actions
    this.executeAlertActions(rule, alert);

    // Emit alert event
    gps51EventBus.emit('gps51.alert.triggered', alert, {
      source: 'alerts_manager',
      priority: rule.severity === 'critical' ? 'critical' : 'high'
    });

    console.log('GPS51RealTimeAlertsManager: Alert triggered:', {
      id: alertId,
      type: rule.type,
      vehicleId,
      severity: rule.severity,
      message: alert.message
    });
  }

  private resolveAlert(vehicleId: string, ruleId: string): void {
    // Find and resolve active alerts for this vehicle and rule
    const alertsToResolve = Array.from(this.activeAlerts.values())
      .filter(alert => alert.vehicleId === vehicleId && alert.ruleId === ruleId && !alert.resolvedAt);

    alertsToResolve.forEach(alert => {
      alert.resolvedAt = Date.now();
      
      gps51EventBus.emit('gps51.alert.resolved', alert, {
        source: 'alerts_manager',
        priority: 'normal'
      });

      console.log('GPS51RealTimeAlertsManager: Alert resolved:', {
        id: alert.id,
        type: alert.type,
        vehicleId
      });
    });
  }

  private generateAlertMessage(rule: AlertRule, data: any): string {
    const vehicleName = data.device?.devicename || data.deviceid || 'Unknown Vehicle';
    
    switch (rule.type) {
      case 'speed':
        return `${vehicleName} is exceeding speed limit: ${Math.round(data.speed || 0)} km/h`;
      case 'fuel':
        return `${vehicleName} has low fuel level: ${(data.fuelLevel || 0).toFixed(1)}%`;
      case 'temperature':
        return `${vehicleName} engine overheating: ${(data.engineTemperature || 0).toFixed(1)}°C`;
      case 'battery':
        return `${vehicleName} has low battery voltage: ${(data.batteryVoltage || 0).toFixed(1)}V`;
      case 'panic':
        return `${vehicleName} panic button activated!`;
      default:
        return `${vehicleName} alert: ${rule.name}`;
    }
  }

  private executeAlertActions(rule: AlertRule, alert: ActiveAlert): void {
    rule.actions.forEach(action => {
      try {
        switch (action.type) {
          case 'notification':
            this.sendNotification(alert, action.config);
            break;
          case 'log':
            this.logAlert(alert, action.config);
            break;
          case 'email':
            this.sendEmailAlert(alert, action.config);
            break;
          case 'webhook':
            this.sendWebhookAlert(alert, action.config);
            break;
        }
      } catch (error) {
        console.error('GPS51RealTimeAlertsManager: Action execution failed:', {
          alertId: alert.id,
          actionType: action.type,
          error: error instanceof Error ? error.message : error
        });
      }
    });
  }

  private sendNotification(alert: ActiveAlert, config: any): void {
    // Queue notification for UI
    gps51UpdateQueue.enqueue({
      type: 'custom',
      priority: alert.severity === 'critical' ? 'critical' : 'high',
      data: {
        eventType: 'gps51.notification.show',
        eventData: {
          title: `${alert.type.toUpperCase()} Alert`,
          message: alert.message,
          severity: alert.severity,
          vehicleId: alert.vehicleId,
          alertId: alert.id
        }
      },
      source: 'alerts_manager',
      maxRetries: 2
    });
  }

  private logAlert(alert: ActiveAlert, config: any): void {
    const level = config.level || 'info';
    const logData = {
      id: alert.id,
      type: alert.type,
      vehicle: alert.vehicleName,
      message: alert.message,
      timestamp: new Date(alert.timestamp).toISOString()
    };

    switch (level) {
      case 'error':
        console.error(`GPS51 Alert [${alert.severity.toUpperCase()}]:`, logData);
        break;
      case 'warning':
        console.warn(`GPS51 Alert [${alert.severity.toUpperCase()}]:`, logData);
        break;
      default:
        console.log(`GPS51 Alert [${alert.severity.toUpperCase()}]:`, logData);
        break;
    }
  }

  private sendEmailAlert(alert: ActiveAlert, config: any): void {
    // Implementation would send email via email service
    console.log('GPS51RealTimeAlertsManager: Email alert would be sent:', {
      alert: alert.id,
      template: config.template
    });
  }

  private sendWebhookAlert(alert: ActiveAlert, config: any): void {
    // Implementation would send webhook
    console.log('GPS51RealTimeAlertsManager: Webhook alert would be sent:', {
      alert: alert.id,
      url: config.url
    });
  }

  private handlePanicButton(data: any): void {
    const vehicleId = data.vehicleId || data.deviceid;
    if (!vehicleId) return;

    // Create immediate panic alert
    const alertId = this.generateAlertId();
    const alert: ActiveAlert = {
      id: alertId,
      ruleId: 'panic_button',
      vehicleId,
      vehicleName: data.vehicleName || vehicleId,
      type: 'panic',
      severity: 'critical',
      message: `${data.vehicleName || vehicleId} panic button activated!`,
      timestamp: Date.now(),
      data: { ...data },
      acknowledged: false
    };

    this.activeAlerts.set(alertId, alert);
    this.alertHistory.unshift(alert);

    // Immediate notification
    this.sendNotification(alert, { priority: 'critical' });

    gps51EventBus.emit('gps51.alert.panic', alert, {
      source: 'alerts_manager',
      priority: 'critical'
    });

    console.log('GPS51RealTimeAlertsManager: PANIC ALERT:', {
      vehicleId,
      alertId,
      timestamp: alert.timestamp
    });
  }

  private evaluateGeofenceRule(rule: AlertRule, position: any): void {
    // Geofence evaluation would be implemented here
    // This is a placeholder for future geofencing functionality
  }

  // Utility methods
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private clearRuleState(ruleId: string): void {
    // Clear condition states for this rule
    const keysToDelete = Array.from(this.conditionStates.keys())
      .filter(key => key.endsWith(`:${ruleId}`));
    
    keysToDelete.forEach(key => {
      this.conditionStates.delete(key);
    });

    // Clear last alert times for this rule
    const alertKeysToDelete = Array.from(this.lastAlertTimes.keys())
      .filter(key => key.endsWith(`:${ruleId}`));
    
    alertKeysToDelete.forEach(key => {
      this.lastAlertTimes.delete(key);
    });
  }

  // Public API
  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolvedAt)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAlertHistory(limit = 50): ActiveAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log('GPS51RealTimeAlertsManager: Alert acknowledged:', alertId);
      return true;
    }
    return false;
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getAlertStats() {
    const activeAlerts = this.getActiveAlerts();
    
    return {
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
      acknowledgedAlerts: activeAlerts.filter(a => a.acknowledged).length,
      historySize: this.alertHistory.length
    };
  }

  pause(): void {
    console.log('GPS51RealTimeAlertsManager: Alert monitoring paused');
  }

  resume(): void {
    console.log('GPS51RealTimeAlertsManager: Alert monitoring resumed');
  }

  destroy(): void {
    this.rules.clear();
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.lastAlertTimes.clear();
    this.conditionStates.clear();
    console.log('GPS51RealTimeAlertsManager: Destroyed');
  }
}

// Create singleton instance
export const gps51RealTimeAlertsManager = new GPS51RealTimeAlertsManager();