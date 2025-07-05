// Stub implementation until database schema is ready
export interface Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: any;
  radius?: number;
  created_at: string;
}

export interface GeofenceEvent {
  id: string;
  type: 'enter' | 'exit';
  deviceId: string;
  geofenceId: string;
  timestamp: string;
}

export class GPS51GeofenceManager {
  private static instance: GPS51GeofenceManager;

  static getInstance(): GPS51GeofenceManager {
    if (!GPS51GeofenceManager.instance) {
      GPS51GeofenceManager.instance = new GPS51GeofenceManager();
    }
    return GPS51GeofenceManager.instance;
  }

  async createGeofence(): Promise<Geofence> {
    console.log('GPS51GeofenceManager: Geofence creation temporarily disabled - database schema pending');
    return {
      id: `stub-${Date.now()}`,
      name: 'Stub Geofence',
      type: 'circle',
      coordinates: {},
      created_at: new Date().toISOString()
    };
  }

  async updateGeofence(): Promise<Geofence> {
    console.log('GPS51GeofenceManager: Geofence update temporarily disabled - database schema pending');
    return {
      id: `stub-${Date.now()}`,
      name: 'Stub Geofence',
      type: 'circle',
      coordinates: {},
      created_at: new Date().toISOString()
    };
  }

  async deleteGeofence(): Promise<boolean> {
    console.log('GPS51GeofenceManager: Geofence deletion temporarily disabled - database schema pending');
    return true;
  }

  async getGeofences(): Promise<Geofence[]> {
    console.log('GPS51GeofenceManager: Geofence retrieval temporarily disabled - database schema pending');
    return [];
  }

  async getGeofenceEvents(): Promise<GeofenceEvent[]> {
    console.log('GPS51GeofenceManager: Geofence events temporarily disabled - database schema pending');
    return [];
  }
}

export const gps51GeofenceManager = GPS51GeofenceManager.getInstance();