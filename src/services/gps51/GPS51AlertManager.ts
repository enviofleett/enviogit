// GPS51 Alert Manager - Uses mock implementation until database tables are ready
import { mockGPS51AlertManager } from './MockGPS51AlertManager';

// Re-export types for compatibility
export type {
  AlertConfig,
  AlertCondition,
  AlertAction,
  AlertSchedule,
  EscalationRule,
  Alert
} from './MockGPS51AlertManager';

export class GPS51AlertManager {
  private mockService = mockGPS51AlertManager;

  /**
   * Get all alert configurations
   */
  async getAlertConfigs() {
    return await this.mockService.getAlertConfigs();
  }

  /**
   * Create a new alert configuration
   */
  async createAlertConfig(config: any) {
    return await this.mockService.createAlertConfig(config);
  }

  /**
   * Update an existing alert configuration
   */
  async updateAlertConfig(id: string, updates: any) {
    return await this.mockService.updateAlertConfig(id, updates);
  }

  /**
   * Delete an alert configuration
   */
  async deleteAlertConfig(id: string) {
    return await this.mockService.deleteAlertConfig(id);
  }

  /**
   * Get alerts with filtering options
   */
  async getAlerts(options: any = {}) {
    return await this.mockService.getAlerts(options.limit);
  }

  /**
   * Create a new alert
   */
  async createAlert(alertData: any) {
    return await this.mockService.createAlert(alertData);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    return await this.mockService.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string) {
    return await this.mockService.resolveAlert(alertId, resolvedBy);
  }

  /**
   * Process vehicle data and check for alert conditions
   */
  async processVehicleData(vehicleId: string, data: any) {
    return await this.mockService.checkVehicleAlerts(vehicleId, data);
  }

  /**
   * Get alert statistics
   */
  async getAlertStats() {
    return await this.mockService.getStats();
  }

  /**
   * Clear all mock data (for testing)
   */
  clearMockData(): void {
    this.mockService.clearMockData();
  }
}

// Export singleton
export const gps51AlertManager = new GPS51AlertManager();