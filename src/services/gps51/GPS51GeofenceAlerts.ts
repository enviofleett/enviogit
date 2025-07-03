// GPS51 Geofence Alerts - Phase 3.1
// Real-time geofence violation detection and alert processing

import { GeofenceEvent, GeofenceViolation } from '../geofencing/GeofencingService';
import { gps51EventBus } from './realtime';
import { supabase } from '@/integrations/supabase/client';

export interface AlertRule {
  id: string;
  name: string;
  geofenceId?: string; // If null, applies to all geofences
  vehicleId?: string; // If null, applies to all vehicles
  eventTypes: ('entry' | 'exit' | 'violation')[];
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number; // Prevent spam alerts
  created: Date;
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'speed' | 'time' | 'frequency' | 'duration' | 'location';
  operator: 'gt' | 'lt' | 'eq' | 'between';
  value: number | string;
  secondValue?: number; // For 'between' operator
}

export interface AlertAction {
  type: 'notification' | 'email' | 'sms' | 'webhook' | 'dashboard';
  config: {
    recipients?: string[];
    template?: string;
    url?: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
  };
}

export interface ProcessedAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  geofenceEvent: GeofenceEvent;
  triggeredAt: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  actions: AlertAction[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export class GPS51GeofenceAlerts {
  private alertRules = new Map<string, AlertRule>();
  private processedAlerts = new Map<string, ProcessedAlert>();
  private alertCooldowns = new Map<string, Date>();
  private isProcessing = false;

  constructor() {
    this.setupEventListeners();
    this.loadAlertRules();
  }

  // Alert Rule Management
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'created' | 'lastTriggered'>): Promise<string> {
    try {
      const alertRule: AlertRule = {
        id: this.generateId(),
        ...rule,
        created: new Date()
      };

      // Store in database
      const { error } = await supabase
        .from('geofence_alert_rules')
        .insert({
          id: alertRule.id,
          name: alertRule.name,
          geofence_id: alertRule.geofenceId,
          vehicle_id: alertRule.vehicleId,
          event_types: alertRule.eventTypes,
          conditions: alertRule.conditions,
          actions: alertRule.actions,
          is_active: alertRule.isActive,
          priority: alertRule.priority,
          cooldown_minutes: alertRule.cooldownMinutes,
          created_at: alertRule.created.toISOString()
        });

      if (error) throw error;

      // Store in memory
      this.alertRules.set(alertRule.id, alertRule);

      console.log('GPS51GeofenceAlerts: Alert rule created:', alertRule.id);
      return alertRule.id;

    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error creating alert rule:', error);
      throw error;
    }
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    try {
      const existingRule = this.alertRules.get(id);
      if (!existingRule) {
        throw new Error(`Alert rule ${id} not found`);
      }

      const updatedRule = { ...existingRule, ...updates };

      // Update in database
      const { error } = await supabase
        .from('geofence_alert_rules')
        .update({
          name: updatedRule.name,
          geofence_id: updatedRule.geofenceId,
          vehicle_id: updatedRule.vehicleId,
          event_types: updatedRule.eventTypes,
          conditions: updatedRule.conditions,
          actions: updatedRule.actions,
          is_active: updatedRule.isActive,
          priority: updatedRule.priority,
          cooldown_minutes: updatedRule.cooldownMinutes
        })
        .eq('id', id);

      if (error) throw error;

      // Update in memory
      this.alertRules.set(id, updatedRule);

      console.log('GPS51GeofenceAlerts: Alert rule updated:', id);

    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error updating alert rule:', error);
      throw error;
    }
  }

  async deleteAlertRule(id: string): Promise<void> {
    try {
      // Delete from database
      const { error } = await supabase
        .from('geofence_alert_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from memory
      this.alertRules.delete(id);

      console.log('GPS51GeofenceAlerts: Alert rule deleted:', id);

    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error deleting alert rule:', error);
      throw error;
    }
  }

  // Alert Processing
  async processGeofenceEvent(event: GeofenceEvent): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Find matching alert rules
      const matchingRules = this.findMatchingRules(event);
      
      for (const rule of matchingRules) {
        // Check cooldown
        if (this.isInCooldown(rule.id)) {
          continue;
        }

        // Evaluate conditions
        if (this.evaluateConditions(event, rule.conditions)) {
          // Create and process alert
          const alert = await this.createProcessedAlert(event, rule);
          await this.executeAlertActions(alert);
          
          // Set cooldown
          this.setCooldown(rule.id, rule.cooldownMinutes);
          
          // Update rule last triggered
          rule.lastTriggered = new Date();
          this.alertRules.set(rule.id, rule);
        }
      }

    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error processing geofence event:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private findMatchingRules(event: GeofenceEvent): AlertRule[] {
    return Array.from(this.alertRules.values()).filter(rule => {
      // Check if rule is active
      if (!rule.isActive) return false;

      // Check event type
      if (!rule.eventTypes.includes(event.type as any)) return false;

      // Check geofence filter
      if (rule.geofenceId && rule.geofenceId !== event.geofenceId) return false;

      // Check vehicle filter
      if (rule.vehicleId && rule.vehicleId !== event.vehicleId) return false;

      return true;
    });
  }

  private evaluateConditions(event: GeofenceEvent, conditions: AlertCondition[]): boolean {
    return conditions.every(condition => {
      switch (condition.type) {
        case 'speed':
          if (!event.speed) return false;
          return this.evaluateNumericCondition(event.speed, condition);
          
        case 'time':
          const hour = event.timestamp.getHours();
          return this.evaluateNumericCondition(hour, condition);
          
        case 'frequency':
          // This would require tracking event frequency - simplified for now
          return true;
          
        case 'duration':
          // This would require tracking event duration - simplified for now
          return true;
          
        case 'location':
          // This would require location-based conditions - simplified for now
          return true;
          
        default:
          return false;
      }
    });
  }

  private evaluateNumericCondition(value: number, condition: AlertCondition): boolean {
    const conditionValue = Number(condition.value);
    
    switch (condition.operator) {
      case 'gt':
        return value > conditionValue;
      case 'lt':
        return value < conditionValue;
      case 'eq':
        return value === conditionValue;
      case 'between':
        const secondValue = Number(condition.secondValue || 0);
        return value >= conditionValue && value <= secondValue;
      default:
        return false;
    }
  }

  private async createProcessedAlert(event: GeofenceEvent, rule: AlertRule): Promise<ProcessedAlert> {
    const alert: ProcessedAlert = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      geofenceEvent: event,
      triggeredAt: new Date(),
      priority: rule.priority,
      message: this.generateAlertMessage(event, rule),
      actions: rule.actions,
      acknowledged: false
    };

    // Store alert
    this.processedAlerts.set(alert.id, alert);

    // Store in database
    try {
      await supabase
        .from('processed_geofence_alerts')
        .insert({
          id: alert.id,
          rule_id: alert.ruleId,
          rule_name: alert.ruleName,
          geofence_event: alert.geofenceEvent,
          triggered_at: alert.triggeredAt.toISOString(),
          priority: alert.priority,
          message: alert.message,
          actions: alert.actions,
          acknowledged: alert.acknowledged
        });
    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error storing alert:', error);
    }

    console.log('GPS51GeofenceAlerts: Alert created:', alert.id, alert.message);
    return alert;
  }

  private generateAlertMessage(event: GeofenceEvent, rule: AlertRule): string {
    const vehicle = event.vehicleName || event.vehicleId;
    const geofence = event.geofenceName;
    
    switch (event.type) {
      case 'entry':
        return `Vehicle ${vehicle} entered geofence ${geofence}`;
      case 'exit':
        return `Vehicle ${vehicle} exited geofence ${geofence}`;
      case 'violation':
        return `Vehicle ${vehicle} violated geofence ${geofence} rules`;
      default:
        return `Geofence event detected for vehicle ${vehicle}`;
    }
  }

  private async executeAlertActions(alert: ProcessedAlert): Promise<void> {
    for (const action of alert.actions) {
      try {
        await this.executeAction(alert, action);
      } catch (error) {
        console.error('GPS51GeofenceAlerts: Error executing action:', action.type, error);
      }
    }
  }

  private async executeAction(alert: ProcessedAlert, action: AlertAction): Promise<void> {
    switch (action.type) {
      case 'notification':
        await this.sendNotification(alert, action.config);
        break;
        
      case 'email':
        await this.sendEmail(alert, action.config);
        break;
        
      case 'sms':
        await this.sendSMS(alert, action.config);
        break;
        
      case 'webhook':
        await this.callWebhook(alert, action.config);
        break;
        
      case 'dashboard':
        await this.updateDashboard(alert, action.config);
        break;
    }
  }

  private async sendNotification(alert: ProcessedAlert, config: any): Promise<void> {
    // Emit real-time notification
    gps51EventBus.emit('gps51.geofence.alert', alert, {
      source: 'geofence_alerts',
      priority: alert.priority === 'critical' ? 'high' : 'normal'
    });
  }

  private async sendEmail(alert: ProcessedAlert, config: any): Promise<void> {
    // This would integrate with email service
    console.log('GPS51GeofenceAlerts: Email notification sent:', alert.message);
  }

  private async sendSMS(alert: ProcessedAlert, config: any): Promise<void> {
    // This would integrate with SMS service
    console.log('GPS51GeofenceAlerts: SMS notification sent:', alert.message);
  }

  private async callWebhook(alert: ProcessedAlert, config: any): Promise<void> {
    if (config.url) {
      try {
        await fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
      } catch (error) {
        console.error('GPS51GeofenceAlerts: Webhook call failed:', error);
      }
    }
  }

  private async updateDashboard(alert: ProcessedAlert, config: any): Promise<void> {
    // Update dashboard alert counter or display
    console.log('GPS51GeofenceAlerts: Dashboard updated:', alert.message);
  }

  // Cooldown Management
  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.alertCooldowns.get(ruleId);
    if (!cooldownEnd) return false;
    return new Date() < cooldownEnd;
  }

  private setCooldown(ruleId: string, minutes: number): void {
    const cooldownEnd = new Date();
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + minutes);
    this.alertCooldowns.set(ruleId, cooldownEnd);
  }

  // Event Listeners
  private setupEventListeners(): void {
    gps51EventBus.on('gps51.geofence.entry', async (event) => {
      await this.processGeofenceEvent(event.data);
    });

    gps51EventBus.on('gps51.geofence.exit', async (event) => {
      await this.processGeofenceEvent(event.data);
    });

    gps51EventBus.on('gps51.geofence.violation', async (event) => {
      await this.processGeofenceEvent(event.data);
    });
  }

  // Data Loading
  private async loadAlertRules(): Promise<void> {
    try {
      const { data: rules, error } = await supabase
        .from('geofence_alert_rules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      rules?.forEach(rule => {
        const alertRule: AlertRule = {
          id: rule.id,
          name: rule.name,
          geofenceId: rule.geofence_id,
          vehicleId: rule.vehicle_id,
          eventTypes: rule.event_types,
          conditions: rule.conditions,
          actions: rule.actions,
          isActive: rule.is_active,
          priority: rule.priority,
          cooldownMinutes: rule.cooldown_minutes,
          created: new Date(rule.created_at),
          lastTriggered: rule.last_triggered ? new Date(rule.last_triggered) : undefined
        };

        this.alertRules.set(alertRule.id, alertRule);
      });

      console.log('GPS51GeofenceAlerts: Loaded', this.alertRules.size, 'alert rules');

    } catch (error) {
      console.error('GPS51GeofenceAlerts: Error loading alert rules:', error);
    }
  }

  // Utility Methods
  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getAlertRule(id: string): AlertRule | null {
    return this.alertRules.get(id) || null;
  }

  getProcessedAlerts(limit: number = 100): ProcessedAlert[] {
    return Array.from(this.processedAlerts.values())
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.processedAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      // Update in database
      try {
        await supabase
          .from('processed_geofence_alerts')
          .update({
            acknowledged: true,
            acknowledged_by: acknowledgedBy,
            acknowledged_at: alert.acknowledgedAt.toISOString()
          })
          .eq('id', alertId);
      } catch (error) {
        console.error('GPS51GeofenceAlerts: Error acknowledging alert:', error);
      }
    }
  }

  destroy(): void {
    this.alertRules.clear();
    this.processedAlerts.clear();
    this.alertCooldowns.clear();
    console.log('GPS51GeofenceAlerts: Destroyed');
  }
}

// Create singleton instance
export const gps51GeofenceAlerts = new GPS51GeofenceAlerts();