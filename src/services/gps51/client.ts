
import { GPS51Vehicle, GPS51Position, GPS51Telemetry, GPS51Geofence, GPS51ApiConfig } from './types';

export class GPS51Client {
  private config: GPS51ApiConfig;

  constructor(config: GPS51ApiConfig) {
    this.config = config;
  }

  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`GPS51 API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Vehicle Management
  async getVehicles(): Promise<GPS51Vehicle[]> {
    return this.makeRequest<GPS51Vehicle[]>('/vehicles');
  }

  async getVehicle(id: string): Promise<GPS51Vehicle> {
    return this.makeRequest<GPS51Vehicle>(`/vehicles/${id}`);
  }

  // Real-time Positions
  async getVehiclePosition(vehicleId: string): Promise<GPS51Position> {
    return this.makeRequest<GPS51Position>(`/vehicles/${vehicleId}/position`);
  }

  async getAllVehiclePositions(): Promise<GPS51Position[]> {
    return this.makeRequest<GPS51Position[]>('/positions/latest');
  }

  // Historical Data
  async getVehicleHistory(
    vehicleId: string,
    from: Date,
    to: Date
  ): Promise<GPS51Position[]> {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    return this.makeRequest<GPS51Position[]>(`/vehicles/${vehicleId}/history?${params}`);
  }

  // Telemetry Data
  async getVehicleTelemetry(vehicleId: string): Promise<GPS51Telemetry> {
    return this.makeRequest<GPS51Telemetry>(`/vehicles/${vehicleId}/telemetry`);
  }

  // Geofencing
  async getGeofences(): Promise<GPS51Geofence[]> {
    return this.makeRequest<GPS51Geofence[]>('/geofences');
  }

  async createGeofence(geofence: Omit<GPS51Geofence, 'id'>): Promise<GPS51Geofence> {
    return this.makeRequest<GPS51Geofence>('/geofences', {
      method: 'POST',
      body: JSON.stringify(geofence),
    });
  }
}
