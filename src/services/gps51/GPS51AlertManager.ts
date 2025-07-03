// GPS51 Alert Manager - Phase 3.3
// Intelligent alert system with multi-channel notifications

import { supabase } from '@/integrations/supabase/client';
import { gps51EventBus } from './realtime';

export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  type: 'geofence' | 'speed' | 'maintenance' | 'fuel' | 'battery' | 'panic' | 'custom';
  severity: 'info' | 'warning' | 'error' | 'critical';
  isActive: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  schedule?: AlertSchedule;
  cooldownSeconds: number;
  autoResolve: boolean;
  escalationRules?: EscalationRule[];
  created: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  field: string; // e.g., 'speed', 'battery_level', 'geofence_status'
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains';
  value: any;
  unit?: string;
}

export interface AlertAction {
  type: 'notification' | 'email' | 'sms' | 'webhook' | 'push' | 'dashboard';
  config: {
    recipients?: string[];
    template?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    payload?: any;
    channel?: string;
  };
  delay?: number; // Delay in seconds before executing
}

export interface AlertSchedule {
  enabled: boolean;
  timezone: string;
  days: number[]; // 0-6 (Sunday to Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface EscalationRule {
  level: number;
  delayMinutes: number;
  actions: AlertAction[];
  condition?: string; // Optional condition for escalation
}

export interface Alert {
  id: string;
  configId: string;
  configName: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  vehicleId?: string;
  deviceId?: string;
  location?: { lat: number; lng: number };
  data: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  escalationLevel: number;
  lastEscalatedAt?: Date;
  actionLog: AlertActionLog[];
}

export interface AlertActionLog {
  id: string;
  alertId: string;
  action: AlertAction;
  executedAt: Date;
  status: 'success' | 'failed' | 'pending';
  response?: any;
  error?: string;
}

export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  responseTime: number; // Average response time in minutes
  escalationRate: number;
}

export class GPS51AlertManager {
  private alertConfigs = new Map<string, AlertConfig>();
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private cooldowns = new Map<string, Date>();
  private escalationTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.setupEventListeners();
    this.loadAlertConfigs();
    this.startMaintenanceTasks();
  }

  // Alert Configuration Management
  async createAlertConfig(config: Omit<AlertConfig, 'id' | 'created' | 'updatedAt'>): Promise<string> {
    try {
      const alertConfig: AlertConfig = {
        id: this.generateId('config'),
        ...config,
        created: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      const { error } = await supabase
        .from('alert_configs')
        .insert({
          name: alertConfig.name,
          description: alertConfig.description,
          type: alertConfig.type,
          severity: alertConfig.severity,
          is_active: alertConfig.isActive,
          conditions: alertConfig.conditions as any,
          actions: alertConfig.actions as any,
          schedule: alertConfig.schedule as any,
          cooldown_seconds: alertConfig.cooldownSeconds,
          auto_resolve: alertConfig.autoResolve,
          escalation_rules: alertConfig.escalationRules as any,
          created_at: alertConfig.created.toISOString(),
          updated_at: alertConfig.updatedAt.toISOString()
        });

      if (error) throw error;

      // Store in memory
      this.alertConfigs.set(alertConfig.id, alertConfig);

      console.log('GPS51AlertManager: Alert config created:', alertConfig.id);
      return alertConfig.id;

    } catch (error) {
      console.error('GPS51AlertManager: Error creating alert config:', error);
      throw error;
    }
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<void> {
    try {
      const existingConfig = this.alertConfigs.get(id);
      if (!existingConfig) {
        throw new Error(`Alert config ${id} not found`);
      }

      const updatedConfig = {
        ...existingConfig,
        ...updates,
        updatedAt: new Date()
      };

      // Update in database
      const { error } = await supabase
        .from('alert_configs')
        .update({
          name: updatedConfig.name,
          description: updatedConfig.description,
          type: updatedConfig.type,
          severity: updatedConfig.severity,
          is_active: updatedConfig.isActive,
          conditions: updatedConfig.conditions as any,
          actions: updatedConfig.actions as any,
          schedule: updatedConfig.schedule as any,
          cooldown_seconds: updatedConfig.cooldownSeconds,
          auto_resolve: updatedConfig.autoResolve,
          escalation_rules: updatedConfig.escalationRules as any,
          updated_at: updatedConfig.updatedAt.toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update in memory
      this.alertConfigs.set(id, updatedConfig);

      console.log('GPS51AlertManager: Alert config updated:', id);

    } catch (error) {
      console.error('GPS51AlertManager: Error updating alert config:', error);
      throw error;
    }
  }

  async deleteAlertConfig(id: string): Promise<void> {
    try {
      // Delete from database
      const { error } = await supabase
        .from('alert_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from memory
      this.alertConfigs.delete(id);

      console.log('GPS51AlertManager: Alert config deleted:', id);

    } catch (error) {
      console.error('GPS51AlertManager: Error deleting alert config:', error);
      throw error;
    }
  }

  // Alert Processing
  async processEvent(eventType: string, data: any): Promise<Alert[]> {
    const matchingConfigs = this.findMatchingConfigs(eventType, data);
    const createdAlerts: Alert[] = [];

    for (const config of matchingConfigs) {
      try {
        // Check if config is active and within schedule
        if (!this.isConfigActiveNow(config)) {
          continue;
        }

        // Check cooldown
        if (this.isInCooldown(config.id, data)) {
          continue;
        }

        // Evaluate conditions
        if (this.evaluateConditions(config.conditions, data)) {
          const alert = await this.createAlert(config, data);
          createdAlerts.push(alert);
          
          // Set cooldown
          this.setCooldown(config.id, data, config.cooldownSeconds);
          
          // Execute immediate actions
          await this.executeAlertActions(alert, config.actions);
          
          // Setup escalation if configured
          this.setupEscalation(alert, config);
        }

      } catch (error) {
        console.error('GPS51AlertManager: Error processing alert config:', config.id, error);
      }
    }

    return createdAlerts;
  }

  private findMatchingConfigs(eventType: string, data: any): AlertConfig[] {
    return Array.from(this.alertConfigs.values()).filter(config => {
      // Basic type matching
      if (config.type !== eventType && config.type !== 'custom') {
        return false;
      }

      // Additional filtering could be added here
      return config.isActive;
    });
  }

  private isConfigActiveNow(config: AlertConfig): boolean {
    if (!config.isActive) return false;
    
    if (!config.schedule?.enabled) return true;
    
    const now = new Date();
    const schedule = config.schedule;
    
    // Check day of week
    if (!schedule.days.includes(now.getDay())) {
      return false;
    }
    
    // Check time range
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
  }

  private evaluateConditions(conditions: AlertCondition[], data: any): boolean {
    return conditions.every(condition => {
      const value = this.getValueFromData(data, condition.field);
      return this.evaluateCondition(value, condition);
    });
  }

  private getValueFromData(data: any, field: string): any {
    // Support nested field access with dot notation
    const parts = field.split('.');
    let value = data;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateCondition(value: any, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'contains':
        return String(value).includes(String(condition.value));
      default:
        return false;
    }
  }

  private async createAlert(config: AlertConfig, data: any): Promise<Alert> {
    const alert: Alert = {
      id: this.generateId('alert'),
      configId: config.id,
      configName: config.name,
      type: config.type,
      severity: config.severity,
      title: this.generateAlertTitle(config, data),
      message: this.generateAlertMessage(config, data),
      vehicleId: data.vehicleId,
      deviceId: data.deviceId,
      location: data.location,
      data,
      status: 'active',
      createdAt: new Date(),
      escalationLevel: 0,
      actionLog: []
    };

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Store in database
    try {
      await supabase
        .from('alerts')
        .insert({
          id: alert.id,
          config_id: alert.configId,
          config_name: alert.configName,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          vehicle_id: alert.vehicleId,
          device_id: alert.deviceId,
          location: alert.location,
          data: alert.data,
          status: alert.status,
          created_at: alert.createdAt.toISOString(),
          escalation_level: alert.escalationLevel
        });
    } catch (error) {
      console.error('GPS51AlertManager: Error storing alert:', error);
    }

    // Emit alert event
    gps51EventBus.emit('gps51.alert.created', alert, {
      source: 'alert_manager',
      priority: alert.severity === 'critical' ? 'high' : 'normal'
    });

    console.log('GPS51AlertManager: Alert created:', alert.id, alert.title);
    return alert;
  }

  private generateAlertTitle(config: AlertConfig, data: any): string {
    const vehicle = data.vehicleName || data.vehicleId || 'Unknown Vehicle';
    return `${config.name} - ${vehicle}`;
  }

  private generateAlertMessage(config: AlertConfig, data: any): string {
    switch (config.type) {
      case 'speed':
        return `Vehicle exceeded speed limit: ${data.speed} km/h`;
      case 'geofence':
        return `Geofence ${data.eventType}: ${data.geofenceName}`;
      case 'battery':
        return `Low battery warning: ${data.batteryLevel}%`;
      case 'maintenance':
        return `Maintenance required: ${data.maintenanceType}`;
      default:
        return config.description || 'Alert triggered';
    }
  }

  // Alert Actions
  private async executeAlertActions(alert: Alert, actions: AlertAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(alert, action);
      } catch (error) {
        console.error('GPS51AlertManager: Error executing action:', action.type, error);
        
        // Log failed action
        const actionLog: AlertActionLog = {
          id: this.generateId('action'),
          alertId: alert.id,
          action,
          executedAt: new Date(),
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        alert.actionLog.push(actionLog);
      }
    }
  }

  private async executeAction(alert: Alert, action: AlertAction): Promise<void> {
    // Apply delay if specified
    if (action.delay && action.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay! * 1000));
    }

    const actionLog: AlertActionLog = {
      id: this.generateId('action'),
      alertId: alert.id,
      action,
      executedAt: new Date(),
      status: 'pending'
    };

    try {
      let response: any = null;

      switch (action.type) {
        case 'notification':
          response = await this.sendNotification(alert, action.config);
          break;
        case 'email':
          response = await this.sendEmail(alert, action.config);
          break;
        case 'sms':
          response = await this.sendSMS(alert, action.config);
          break;
        case 'webhook':
          response = await this.callWebhook(alert, action.config);
          break;
        case 'push':
          response = await this.sendPushNotification(alert, action.config);
          break;
        case 'dashboard':
          response = await this.updateDashboard(alert, action.config);
          break;
      }

      actionLog.status = 'success';
      actionLog.response = response;

    } catch (error) {
      actionLog.status = 'failed';
      actionLog.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      alert.actionLog.push(actionLog);
    }
  }

  private async sendNotification(alert: Alert, config: any): Promise<any> {
    gps51EventBus.emit('gps51.notification', {
      type: 'alert',
      alert,
      recipients: config.recipients
    }, {
      source: 'alert_manager',
      priority: alert.severity === 'critical' ? 'high' : 'normal'
    });

    return { sent: true, type: 'notification' };
  }

  private async sendEmail(alert: Alert, config: any): Promise<any> {
    // This would integrate with email service
    console.log('GPS51AlertManager: Email sent:', alert.title, config.recipients);
    return { sent: true, type: 'email', recipients: config.recipients };
  }

  private async sendSMS(alert: Alert, config: any): Promise<any> {
    // This would integrate with SMS service
    console.log('GPS51AlertManager: SMS sent:', alert.title, config.recipients);
    return { sent: true, type: 'sms', recipients: config.recipients };
  }

  private async callWebhook(alert: Alert, config: any): Promise<any> {
    if (!config.url) throw new Error('Webhook URL not configured');

    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      body: JSON.stringify(config.payload || alert)
    });

    if (!response.ok) {
      throw new Error(`Webhook call failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async sendPushNotification(alert: Alert, config: any): Promise<any> {
    // This would integrate with push notification service
    console.log('GPS51AlertManager: Push notification sent:', alert.title);
    return { sent: true, type: 'push' };
  }

  private async updateDashboard(alert: Alert, config: any): Promise<any> {
    // Update dashboard components
    gps51EventBus.emit('gps51.dashboard.alert', alert, {
      source: 'alert_manager',
      priority: 'normal'
    });
    
    return { updated: true, type: 'dashboard' };
  }

  // Escalation Management
  private setupEscalation(alert: Alert, config: AlertConfig): void {
    if (!config.escalationRules || config.escalationRules.length === 0) {
      return;
    }

    const nextRule = config.escalationRules.find(rule => rule.level === alert.escalationLevel + 1);
    if (!nextRule) return;

    const escalationTimer = setTimeout(async () => {
      await this.escalateAlert(alert, nextRule);
    }, nextRule.delayMinutes * 60 * 1000);

    this.escalationTimers.set(alert.id, escalationTimer);
  }

  private async escalateAlert(alert: Alert, rule: EscalationRule): Promise<void> {
    try {
      // Check if alert is still active
      if (alert.status !== 'active') {
        return;
      }

      // Check escalation condition if specified
      if (rule.condition && !this.evaluateEscalationCondition(alert, rule.condition)) {
        return;
      }

      // Update alert
      alert.escalationLevel = rule.level;
      alert.lastEscalatedAt = new Date();
      alert.status = 'escalated';

      // Execute escalation actions
      await this.executeAlertActions(alert, rule.actions);

      // Update in database
      await supabase
        .from('alerts')
        .update({
          escalation_level: alert.escalationLevel,
          last_escalated_at: alert.lastEscalatedAt.toISOString(),
          status: alert.status
        })
        .eq('id', alert.id);

      // Setup next escalation level
      const config = this.alertConfigs.get(alert.configId);
      if (config) {
        this.setupEscalation(alert, config);
      }

      // Emit escalation event
      gps51EventBus.emit('gps51.alert.escalated', alert, {
        source: 'alert_manager',
        priority: 'high'
      });

      console.log('GPS51AlertManager: Alert escalated:', alert.id, 'Level:', rule.level);

    } catch (error) {
      console.error('GPS51AlertManager: Error escalating alert:', error);
    }
  }

  private evaluateEscalationCondition(alert: Alert, condition: string): boolean {
    // This would evaluate the escalation condition
    // For now, always return true
    return true;
  }

  // Alert Management
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Update in database
    await supabase
      .from('alerts')
      .update({
        status: alert.status,
        acknowledged_at: alert.acknowledgedAt.toISOString(),
        acknowledged_by: alert.acknowledgedBy
      })
      .eq('id', alertId);

    // Emit acknowledgment event
    gps51EventBus.emit('gps51.alert.acknowledged', alert, {
      source: 'alert_manager',
      priority: 'normal'
    });

    console.log('GPS51AlertManager: Alert acknowledged:', alertId, 'by:', acknowledgedBy);
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Clear escalation timer
    const timer = this.escalationTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this.escalationTimers.delete(alertId);
    }

    // Remove from active alerts
    this.activeAlerts.delete(alertId);

    // Update in database
    await supabase
      .from('alerts')
      .update({
        status: alert.status,
        resolved_at: alert.resolvedAt.toISOString(),
        resolved_by: alert.resolvedBy
      })
      .eq('id', alertId);

    // Emit resolution event
    gps51EventBus.emit('gps51.alert.resolved', alert, {
      source: 'alert_manager',
      priority: 'normal'
    });

    console.log('GPS51AlertManager: Alert resolved:', alertId, 'by:', resolvedBy);
  }

  // Cooldown Management
  private isInCooldown(configId: string, data: any): boolean {
    const key = this.getCooldownKey(configId, data);
    const cooldownEnd = this.cooldowns.get(key);
    if (!cooldownEnd) return false;
    return new Date() < cooldownEnd;
  }

  private setCooldown(configId: string, data: any, seconds: number): void {
    const key = this.getCooldownKey(configId, data);
    const cooldownEnd = new Date();
    cooldownEnd.setSeconds(cooldownEnd.getSeconds() + seconds);
    this.cooldowns.set(key, cooldownEnd);
  }

  private getCooldownKey(configId: string, data: any): string {
    // Create a unique key for cooldown tracking
    const vehicle = data.vehicleId || 'global';
    return `${configId}_${vehicle}`;
  }

  // Maintenance Tasks
  private startMaintenanceTasks(): void {
    // Clean up old cooldowns every hour
    setInterval(() => {
      const now = new Date();
      for (const [key, cooldownEnd] of this.cooldowns.entries()) {
        if (now >= cooldownEnd) {
          this.cooldowns.delete(key);
        }
      }
    }, 60 * 60 * 1000);

    // Auto-resolve old alerts
    setInterval(() => {
      this.autoResolveOldAlerts();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  private autoResolveOldAlerts(): void {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24); // 24 hours ago

    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.createdAt < cutoffTime) {
        const config = this.alertConfigs.get(alert.configId);
        if (config?.autoResolve) {
          this.resolveAlert(alertId, 'system');
        }
      }
    }
  }

  // Data Loading
  private async loadAlertConfigs(): Promise<void> {
    try {
      const { data: configs, error } = await supabase
        .from('alert_configs')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      configs?.forEach(config => {
        const alertConfig: AlertConfig = {
          id: config.id,
          name: config.name,
          description: config.description,
          type: config.type as any,
          severity: config.severity as any,
          isActive: config.is_active,
          conditions: (config.conditions as unknown) as AlertCondition[],
          actions: (config.actions as unknown) as AlertAction[],
          schedule: (config.schedule as unknown) as AlertSchedule,
          cooldownSeconds: config.cooldown_seconds,
          autoResolve: config.auto_resolve,
          escalationRules: (config.escalation_rules as unknown) as EscalationRule[],
          created: new Date(config.created_at),
          updatedAt: new Date(config.updated_at)
        };

        this.alertConfigs.set(alertConfig.id, alertConfig);
      });

      console.log('GPS51AlertManager: Loaded', this.alertConfigs.size, 'alert configs');

    } catch (error) {
      console.error('GPS51AlertManager: Error loading alert configs:', error);
    }
  }

  // Event Listeners
  private setupEventListeners(): void {
    // Listen for various system events
    gps51EventBus.on('gps51.speed.violation', async (event) => {
      await this.processEvent('speed', event.data);
    });

    gps51EventBus.on('gps51.geofence.violation', async (event) => {
      await this.processEvent('geofence', event.data);
    });

    gps51EventBus.on('gps51.battery.low', async (event) => {
      await this.processEvent('battery', event.data);
    });

    gps51EventBus.on('gps51.maintenance.due', async (event) => {
      await this.processEvent('maintenance', event.data);
    });
  }

  // Utility Methods
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getAlertConfigs(): AlertConfig[] {
    return Array.from(this.alertConfigs.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  getAlertStats(): AlertStats {
    const total = this.alertHistory.length;
    const active = this.activeAlerts.size;
    const acknowledged = this.alertHistory.filter(a => a.status === 'acknowledged').length;
    const resolved = this.alertHistory.filter(a => a.status === 'resolved').length;
    const critical = this.alertHistory.filter(a => a.severity === 'critical').length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.alertHistory.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    });

    // Calculate average response time
    const acknowledgedAlerts = this.alertHistory.filter(a => a.acknowledgedAt);
    const responseTime = acknowledgedAlerts.length > 0
      ? acknowledgedAlerts.reduce((sum, alert) => {
          const diff = alert.acknowledgedAt!.getTime() - alert.createdAt.getTime();
          return sum + (diff / (1000 * 60)); // Convert to minutes
        }, 0) / acknowledgedAlerts.length
      : 0;

    const escalationRate = total > 0 ? (this.alertHistory.filter(a => a.escalationLevel > 0).length / total) * 100 : 0;

    return {
      total,
      active,
      acknowledged,
      resolved,
      critical,
      byType,
      bySeverity,
      responseTime,
      escalationRate
    };
  }

  destroy(): void {
    // Clear all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    
    this.alertConfigs.clear();
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.cooldowns.clear();
    this.escalationTimers.clear();
    
    console.log('GPS51AlertManager: Destroyed');
  }
}

// Create singleton instance
export const gps51AlertManager = new GPS51AlertManager();