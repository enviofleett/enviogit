// Mock Geofencing Service - Complete implementation
// This replaces the GeofencingService until proper database tables are created

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  type: 'circle' | 'polygon';
  coordinates: number[][];
  radius?: number;
  is_active: boolean;
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  alert_on_violation: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeofenceViolation {
  id: string;
  vehicle_id: string;
  geofence_id: string;
  violation_type: 'entry' | 'exit' | 'speeding';
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export class MockGeofencingService {
  private mockGeofences: Geofence[] = [
    {
      id: '1',
      name: 'Main Office',
      description: 'Company headquarters geofence',
      type: 'circle',
      coordinates: [[40.7128, -74.0060]],
      radius: 500,
      is_active: true,
      alert_on_entry: true,
      alert_on_exit: true,
      alert_on_violation: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Warehouse District',
      description: 'Main warehouse and logistics area',
      type: 'polygon',
      coordinates: [
        [40.7500, -74.0100],
        [40.7520, -74.0080],
        [40.7530, -74.0120],
        [40.7510, -74.0140]
      ],
      is_active: true,
      alert_on_entry: true,
      alert_on_exit: true,
      alert_on_violation: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  private mockViolations: GeofenceViolation[] = [];

  /**
   * Get all geofences (mock)
   */
  async getAllGeofences(): Promise<Geofence[]> {
    console.log('MockGeofencingService: Returning mock geofences');
    return this.mockGeofences;
  }

  /**
   * Create geofence (mock)
   */
  async createGeofence(geofence: Omit<Geofence, 'id' | 'created_at' | 'updated_at'>): Promise<Geofence> {
    const newGeofence: Geofence = {
      ...geofence,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.mockGeofences.push(newGeofence);
    console.log('MockGeofencingService: Created geofence', newGeofence.id);
    return newGeofence;
  }

  /**
   * Update geofence (mock)
   */
  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<Geofence | null> {
    const index = this.mockGeofences.findIndex(g => g.id === id);
    if (index === -1) {
      console.log('MockGeofencingService: Geofence not found', id);
      return null;
    }
    
    this.mockGeofences[index] = {
      ...this.mockGeofences[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    console.log('MockGeofencingService: Updated geofence', id);
    return this.mockGeofences[index];
  }

  /**
   * Delete geofence (mock)
   */
  async deleteGeofence(id: string): Promise<boolean> {
    const index = this.mockGeofences.findIndex(g => g.id === id);
    if (index === -1) {
      console.log('MockGeofencingService: Geofence not found for deletion', id);
      return false;
    }
    
    this.mockGeofences.splice(index, 1);
    console.log('MockGeofencingService: Deleted geofence', id);
    return true;
  }

  /**
   * Check if point is inside geofence (mock)
   */
  async checkGeofenceViolation(
    vehicleId: string, 
    latitude: number, 
    longitude: number
  ): Promise<GeofenceViolation[]> {
    // Mock implementation - simulate some violations for testing
    const violations: GeofenceViolation[] = [];
    
    // Simulate a 10% chance of generating a mock violation
    if (Math.random() < 0.1) {
      const randomGeofence = this.mockGeofences[Math.floor(Math.random() * this.mockGeofences.length)];
      if (randomGeofence && randomGeofence.is_active) {
        const violation: GeofenceViolation = {
          id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          vehicle_id: vehicleId,
          geofence_id: randomGeofence.id,
          violation_type: Math.random() > 0.5 ? 'entry' : 'exit',
          timestamp: new Date().toISOString(),
          location: { latitude, longitude }
        };
        
        violations.push(violation);
        this.mockViolations.push(violation);
        
        console.log('MockGeofencingService: Generated mock violation', violation.id);
      }
    }
    
    return violations;
  }

  /**
   * Get violations for vehicle (mock)
   */
  async getViolationsForVehicle(vehicleId: string, limit = 10): Promise<GeofenceViolation[]> {
    const vehicleViolations = this.mockViolations
      .filter(v => v.vehicle_id === vehicleId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    console.log(`MockGeofencingService: Returning ${vehicleViolations.length} violations for vehicle ${vehicleId}`);
    return vehicleViolations;
  }

  /**
   * Get all violations (mock)
   */
  async getAllViolations(limit = 50): Promise<GeofenceViolation[]> {
    const sortedViolations = this.mockViolations
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    console.log(`MockGeofencingService: Returning ${sortedViolations.length} total violations`);
    return sortedViolations;
  }

  /**
   * Get geofencing stats (mock)
   */
  async getStats() {
    return {
      totalGeofences: this.mockGeofences.length,
      activeGeofences: this.mockGeofences.filter(g => g.is_active).length,
      totalViolations: this.mockViolations.length,
      todayViolations: this.mockViolations.filter(v => 
        new Date(v.timestamp).toDateString() === new Date().toDateString()
      ).length
    };
  }

  /**
   * Clear all mock data
   */
  clearMockData(): void {
    this.mockGeofences = [];
    this.mockViolations = [];
    console.log('MockGeofencingService: Cleared all mock data');
  }
}

// Export singleton
export const mockGeofencingService = new MockGeofencingService();