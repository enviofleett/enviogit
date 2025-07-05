// Stub implementation until database schema is ready
export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: any;
  radius?: number;
  created_at: string;
}

export class GPS51GeofenceIntegration {
  private static instance: GPS51GeofenceIntegration;

  static getInstance(): GPS51GeofenceIntegration {
    if (!GPS51GeofenceIntegration.instance) {
      GPS51GeofenceIntegration.instance = new GPS51GeofenceIntegration();
    }
    return GPS51GeofenceIntegration.instance;
  }

  async syncGeofencesWithGPS51(): Promise<void> {
    console.log('GPS51GeofenceIntegration: Geofence sync temporarily disabled - database schema pending');
  }

  async checkGeofenceViolations(): Promise<any[]> {
    console.log('GPS51GeofenceIntegration: Geofence violations temporarily disabled - database schema pending');
    return [];
  }
}

export const gps51GeofenceIntegration = GPS51GeofenceIntegration.getInstance();