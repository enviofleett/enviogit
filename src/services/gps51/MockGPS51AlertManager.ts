// Mock GPS51 Alert Manager - Used until database tables are created
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
  field: string;
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
  delay?: number;
}

export interface AlertSchedule {
  enabled: boolean;
  timezone: string;
  days: number[];
  startTime: string;
  endTime: string;
  excludeDates?: string[];
}

export interface EscalationRule {
  after: number;
  action: AlertAction;
}

export interface Alert {
  id: string;
  configId: string;
  vehicleId: string;
  deviceId?: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  data?: any;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
  escalationLevel?: number;
  lastEscalatedAt?: Date;
}

export class MockGPS51AlertManager {
  private mockAlertConfigs: AlertConfig[] = [
    {
      id: 'speed-alert-1',
      name: 'Speed Limit Alert',
      description: 'Alert when vehicle exceeds speed limit',
      type: 'speed',
      severity: 'warning',
      isActive: true,
      conditions: [{ field: 'speed', operator: 'gt', value: 80, unit: 'km/h' }],
      actions: [{ type: 'email', config: { recipients: ['admin@example.com'] } }],
      cooldownSeconds: 300,
      autoResolve: true,
      created: new Date(),
      updatedAt: new Date()
    }
  ];

  private mockAlerts: Alert[] = [];

  async getAlertConfigs(): Promise<AlertConfig[]> {
    return [...this.mockAlertConfigs];
  }

  async createAlertConfig(config: Omit<AlertConfig, 'id' | 'created' | 'updatedAt'>): Promise<AlertConfig> {
    const newConfig: AlertConfig = {
      ...config,
      id: `config-${Date.now()}`,
      created: new Date(),
      updatedAt: new Date()
    };
    this.mockAlertConfigs.push(newConfig);
    return newConfig;
  }

  async updateAlertConfig(id: string, updates: Partial<AlertConfig>): Promise<AlertConfig | null> {
    const index = this.mockAlertConfigs.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    this.mockAlertConfigs[index] = {
      ...this.mockAlertConfigs[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.mockAlertConfigs[index];
  }

  async deleteAlertConfig(id: string): Promise<boolean> {
    const index = this.mockAlertConfigs.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.mockAlertConfigs.splice(index, 1);
    return true;
  }

  async getAlerts(limit = 50): Promise<Alert[]> {
    return this.mockAlerts.slice(0, limit);
  }

  async createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.mockAlerts.unshift(newAlert);
    return newAlert;
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | null> {
    const index = this.mockAlerts.findIndex(a => a.id === id);
    if (index === -1) return null;
    
    this.mockAlerts[index] = {
      ...this.mockAlerts[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.mockAlerts[index];
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<Alert | null> {
    return await this.updateAlert(id, {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy
    });
  }

  async resolveAlert(id: string, resolvedBy: string): Promise<Alert | null> {
    return await this.updateAlert(id, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy
    });
  }

  async checkVehicleAlerts(vehicleId: string, positionData: any): Promise<Alert[]> {
    // Mock alert checking logic
    const triggeredAlerts: Alert[] = [];
    
    for (const config of this.mockAlertConfigs) {
      if (!config.isActive) continue;
      
      for (const condition of config.conditions) {
        if (this.evaluateCondition(condition, positionData)) {
          const alert = await this.createAlert({
            configId: config.id,
            vehicleId,
            type: config.type,
            severity: config.severity,
            title: config.name,
            message: config.description,
            data: positionData,
            status: 'active'
          });
          triggeredAlerts.push(alert);
        }
      }
    }
    
    return triggeredAlerts;
  }

  private evaluateCondition(condition: AlertCondition, data: any): boolean {
    const fieldValue = data[condition.field];
    if (fieldValue === undefined) return false;
    
    switch (condition.operator) {
      case 'gt': return fieldValue > condition.value;
      case 'lt': return fieldValue < condition.value;
      case 'gte': return fieldValue >= condition.value;
      case 'lte': return fieldValue <= condition.value;
      case 'eq': return fieldValue === condition.value;
      case 'ne': return fieldValue !== condition.value;
      default: return false;
    }
  }

  async getStats() {
    return {
      totalConfigs: this.mockAlertConfigs.length,
      activeConfigs: this.mockAlertConfigs.filter(c => c.isActive).length,
      totalAlerts: this.mockAlerts.length,
      activeAlerts: this.mockAlerts.filter(a => a.status === 'active').length,
      resolvedAlerts: this.mockAlerts.filter(a => a.status === 'resolved').length
    };
  }

  clearMockData(): void {
    this.mockAlertConfigs = [];
    this.mockAlerts = [];
  }
}

// Export singleton
export const mockGPS51AlertManager = new MockGPS51AlertManager();