// Stub implementation until database schema is ready
export class GPS51AlertManager {
  static async getAlertConfigs() {
    console.log('Alert manager temporarily disabled - database schema pending');
    return [];
  }

  static async createAlert() {
    return { success: false, message: 'Database schema pending' };
  }

  static async updateAlert() {
    return { success: false, message: 'Database schema pending' };
  }

  static async deleteAlert() {
    return { success: false, message: 'Database schema pending' };
  }

  static async checkAlerts() {
    return [];
  }

  static async getActiveAlerts() {
    return [];
  }
}

export const gps51AlertManager = new GPS51AlertManager();