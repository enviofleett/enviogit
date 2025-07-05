// Stub implementation until database schema is ready
export class GeofencingService {
  static async checkGeofences() {
    console.log('Geofencing service temporarily disabled - database schema pending');
    return [];
  }

  static async createGeofence() {
    console.log('Geofencing service temporarily disabled - database schema pending');
    return { success: false, message: 'Database schema pending' };
  }

  static async updateGeofence() {
    return { success: false, message: 'Database schema pending' };
  }

  static async deleteGeofence() {
    return { success: false, message: 'Database schema pending' };
  }

  static async getGeofences() {
    return [];
  }
}

export const geofencingService = new GeofencingService();