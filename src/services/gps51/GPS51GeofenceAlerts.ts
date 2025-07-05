// Mock GPS51 Geofence Alerts - Used until database tables are created
import { GeofenceViolation } from '../geofencing/GeofencingService';
import { gps51EventBus } from './realtime';

export interface GeofenceEvent {
  id: string;
  type: 'entry' | 'exit' | 'violation';
  geofenceId: string;
  vehicleId: string;
  deviceId: string;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
  };
  metadata?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  geofenceId: string;
  triggerOnEntry: boolean;
  triggerOnExit: boolean;
  triggerOnViolation: boolean;
  isActive: boolean;
  actions: AlertAction[];
  cooldownMinutes: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'dashboard';
  config: Record<string, any>;
}

export class MockGPS51GeofenceAlerts {
  private mockRules: AlertRule[] = [
    {
      id: 'rule-1',
      name: 'Warehouse Entry Alert',
      description: 'Alert when vehicles enter warehouse area',
      geofenceId: 'warehouse-1',
      triggerOnEntry: true,
      triggerOnExit: false,
      triggerOnViolation: false,
      isActive: true,
      actions: [{ type: 'email', config: { recipients: ['admin@example.com'] } }],
      cooldownMinutes: 30,
      priority: 'medium',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  private processedAlerts = new Set<string>();

  async getAlertRules(): Promise<AlertRule[]> {
    return [...this.mockRules];
  }

  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.mockRules.push(newRule);
    return newRule;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const index = this.mockRules.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    this.mockRules[index] = {
      ...this.mockRules[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.mockRules[index];
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    const index = this.mockRules.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.mockRules.splice(index, 1);
    return true;
  }

  async processGeofenceEvent(event: GeofenceEvent): Promise<void> {
    console.log('Processing geofence event:', event);
    
    // Check which rules apply to this geofence
    const applicableRules = this.mockRules.filter(rule => 
      rule.geofenceId === event.geofenceId && 
      rule.isActive &&
      this.shouldTriggerRule(rule, event)
    );

    for (const rule of applicableRules) {
      const alertKey = `${rule.id}-${event.vehicleId}-${event.timestamp.getTime()}`;
      
      // Check cooldown
      if (this.processedAlerts.has(alertKey)) {
        continue;
      }

      // Execute alert actions
      await this.executeAlertActions(rule, event);
      
      // Track processed alert
      this.processedAlerts.add(alertKey);
      
      // Remove from processed after cooldown
      setTimeout(() => {
        this.processedAlerts.delete(alertKey);
      }, rule.cooldownMinutes * 60 * 1000);
    }
  }

  private shouldTriggerRule(rule: AlertRule, event: GeofenceEvent): boolean {
    switch (event.type) {
      case 'entry':
        return rule.triggerOnEntry;
      case 'exit':
        return rule.triggerOnExit;
      case 'violation':
        return rule.triggerOnViolation;
      default:
        return false;
    }
  }

  private async executeAlertActions(rule: AlertRule, event: GeofenceEvent): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'email':
            gps51EventBus.emit('gps51.geofence.email_alert', {
              rule,
              event,
              recipients: action.config.recipients || []
            }, {
              source: 'geofence_alerts',
              priority: rule.priority === 'critical' ? 'high' : 'normal'
            });
            break;
            
          case 'dashboard':
            gps51EventBus.emit('gps51.geofence.dashboard_alert', {
              rule,
              event
            }, {
              source: 'geofence_alerts',
              priority: 'normal'
            });
            break;
            
          case 'webhook':
            if (action.config.url) {
              await this.executeWebhook(action.config.url, { rule, event });
            }
            break;
        }
      } catch (error) {
        console.error('Failed to execute alert action:', error);
      }
    }
  }

  private async executeWebhook(url: string, payload: any): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Webhook execution failed:', error);
    }
  }

  async getAlertStats() {
    return {
      totalRules: this.mockRules.length,
      activeRules: this.mockRules.filter(r => r.isActive).length,
      processedAlertsCount: this.processedAlerts.size
    };
  }

  clearMockData(): void {
    this.mockRules = [];
    this.processedAlerts.clear();
  }
}

export class GPS51GeofenceAlerts {
  private mockService = new MockGPS51GeofenceAlerts();

  async getAlertRules() {
    return await this.mockService.getAlertRules();
  }

  async createAlertRule(rule: any) {
    return await this.mockService.createAlertRule(rule);
  }

  async updateAlertRule(id: string, updates: any) {
    return await this.mockService.updateAlertRule(id, updates);
  }

  async deleteAlertRule(id: string) {
    return await this.mockService.deleteAlertRule(id);
  }

  async processGeofenceEvent(event: GeofenceEvent) {
    return await this.mockService.processGeofenceEvent(event);
  }

  async getAlertStats() {
    return await this.mockService.getAlertStats();
  }

  clearMockData(): void {
    this.mockService.clearMockData();
  }
}

export const gps51GeofenceAlerts = new GPS51GeofenceAlerts();