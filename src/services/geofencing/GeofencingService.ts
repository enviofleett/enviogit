// Geofencing Service - Uses mock implementation until database tables are ready
import { mockGeofencingService, Geofence, GeofenceViolation, GeofenceEvent } from './MockGeofencingService';

// Re-export types for compatibility
export type { Geofence, GeofenceViolation, GeofenceEvent };

export class GeofencingService {
  private mockService = mockGeofencingService;

  /**
   * Get all geofences
   */
  async getAllGeofences(): Promise<Geofence[]> {
    return await this.mockService.getAllGeofences();
  }

  /**
   * Create a new geofence
   */
  async createGeofence(geofenceData: {
    name: string;
    description?: string;
    type: 'circle' | 'polygon';
    coordinates: number[][];
    radius?: number;
    is_active?: boolean;
    alert_on_entry?: boolean;
    alert_on_exit?: boolean;
    alert_on_violation?: boolean;
  }): Promise<Geofence> {
    const result = await this.mockService.createGeofence({
      ...geofenceData,
      is_active: geofenceData.is_active ?? true,
      alert_on_entry: geofenceData.alert_on_entry ?? true,
      alert_on_exit: geofenceData.alert_on_exit ?? true,
      alert_on_violation: geofenceData.alert_on_violation ?? false
    });
    return result;
  }

  /**
   * Update an existing geofence
   */
  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence | null> {
    return await this.mockService.updateGeofence(id, updates);
  }

  /**
   * Delete a geofence
   */
  async deleteGeofence(id: string): Promise<boolean> {
    return await this.mockService.deleteGeofence(id);
  }

  /**
   * Check if a vehicle position violates any geofences
   */
  async checkGeofenceViolation(
    vehicleId: string, 
    latitude: number, 
    longitude: number
  ): Promise<GeofenceViolation[]> {
    return await this.mockService.checkGeofenceViolation(vehicleId, latitude, longitude);
  }

  /**
   * Get violations for a specific vehicle
   */
  async getViolationsForVehicle(vehicleId: string, limit = 10): Promise<GeofenceViolation[]> {
    return await this.mockService.getViolationsForVehicle(vehicleId, limit);
  }

  /**
   * Get all violations
   */
  async getAllViolations(limit = 50): Promise<GeofenceViolation[]> {
    return await this.mockService.getAllViolations(limit);
  }

  /**
   * Get geofencing statistics
   */
  async getStats() {
    return await this.mockService.getStats();
  }

  /**
   * Load geofences from database
   */
  async loadGeofences(): Promise<Geofence[]> {
    return await this.mockService.getAllGeofences();
  }

  /**
   * Get a single geofence by ID
   */
  async getGeofence(id: string): Promise<Geofence | null> {
    const geofences = await this.mockService.getAllGeofences();
    return geofences.find(g => g.id === id) || null;
  }

  /**
   * Get all geofences (alias for loadGeofences)
   */
  async getGeofences(): Promise<Geofence[]> {
    return await this.loadGeofences();
  }
}

// Export singleton
export const geofencingService = new GeofencingService();