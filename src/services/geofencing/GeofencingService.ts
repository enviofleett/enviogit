// GPS51 Geofencing Service - Phase 3.2
// Provides geofence management, monitoring, and violation detection

import { supabase } from '@/integrations/supabase/client';
import { gps51EventBus } from '../gps51/realtime';

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  type: 'circular' | 'polygon';
  isActive: boolean;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  alertOnViolation: boolean;
  // Circular geofence
  centerLat?: number;
  centerLng?: number;
  radius?: number; // in meters
  // Polygon geofence
  coordinates?: Array<{ lat: number; lng: number }>;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
  schedules?: GeofenceSchedule[];
}

export interface GeofenceSchedule {
  id: string;
  name: string;
  daysOfWeek: number[]; // 0-6 (Sunday to Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive: boolean;
}

export interface GeofenceEvent {
  id: string;
  type: 'entry' | 'exit' | 'violation';
  geofenceId: string;
  geofenceName: string;
  vehicleId: string;
  vehicleName: string;
  driverId?: string;
  driverName?: string;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
  };
  speed?: number;
  duration?: number; // For violations
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface GeofenceViolation extends GeofenceEvent {
  type: 'violation';
  violationType: 'unauthorized_entry' | 'unauthorized_exit' | 'speeding' | 'time_restriction';
  expectedBehavior: string;
  actualBehavior: string;
}

export interface GeofenceStats {
  totalGeofences: number;
  activeGeofences: number;
  totalEvents: number;
  todayEvents: number;
  violations: number;
  topViolatingVehicle: string;
  mostActiveGeofence: string;
}

export class GeofencingService {
  private geofences = new Map<string, Geofence>();
  private events: GeofenceEvent[] = [];
  private monitoringActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize event listeners
    this.setupEventListeners();
  }

  // Geofence Management
  async createGeofence(geofenceData: Omit<Geofence, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const geofence: Geofence = {
        id: this.generateId(),
        ...geofenceData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate geofence data
      this.validateGeofence(geofence);

      // Store in database
      const { error } = await supabase
        .from('geofences')
        .insert({
          name: geofence.name,
          description: geofence.description,
          type: geofence.type,
          is_active: geofence.isActive,
          alert_on_entry: geofence.alertOnEntry,
          alert_on_exit: geofence.alertOnExit,
          alert_on_violation: geofence.alertOnViolation,
          center_lat: geofence.centerLat,
          center_lng: geofence.centerLng,
          radius: geofence.radius,
          coordinates: geofence.coordinates as any,
          created_by: geofence.createdBy,
          tags: geofence.tags,
          schedules: geofence.schedules as any
        });

      if (error) throw error;

      // Store in memory
      this.geofences.set(geofence.id, geofence);

      console.log('GeofencingService: Geofence created:', geofence.id);

      // Emit event
      gps51EventBus.emit('gps51.geofence.created', geofence, {
        source: 'geofencing_service',
        priority: 'normal'
      });

      return geofence.id;

    } catch (error) {
      console.error('GeofencingService: Error creating geofence:', error);
      throw error;
    }
  }

  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<void> {
    try {
      const existingGeofence = this.geofences.get(id);
      if (!existingGeofence) {
        throw new Error(`Geofence ${id} not found`);
      }

      const updatedGeofence: Geofence = {
        ...existingGeofence,
        ...updates,
        updatedAt: new Date()
      };

      // Validate updated geofence
      this.validateGeofence(updatedGeofence);

      // Update in database
      const { error } = await supabase
        .from('geofences')
        .update({
          name: updatedGeofence.name,
          description: updatedGeofence.description,
          type: updatedGeofence.type,
          is_active: updatedGeofence.isActive,
          alert_on_entry: updatedGeofence.alertOnEntry,
          alert_on_exit: updatedGeofence.alertOnExit,
          alert_on_violation: updatedGeofence.alertOnViolation,
          center_lat: updatedGeofence.centerLat,
          center_lng: updatedGeofence.centerLng,
          radius: updatedGeofence.radius,
          coordinates: updatedGeofence.coordinates as any,
          tags: updatedGeofence.tags,
          schedules: updatedGeofence.schedules as any,
          updated_at: updatedGeofence.updatedAt.toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update in memory
      this.geofences.set(id, updatedGeofence);

      console.log('GeofencingService: Geofence updated:', id);

      // Emit event
      gps51EventBus.emit('gps51.geofence.updated', updatedGeofence, {
        source: 'geofencing_service',
        priority: 'normal'
      });

    } catch (error) {
      console.error('GeofencingService: Error updating geofence:', error);
      throw error;
    }
  }

  async deleteGeofence(id: string): Promise<void> {
    try {
      // Delete from database
      const { error } = await supabase
        .from('geofences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remove from memory
      const geofence = this.geofences.get(id);
      this.geofences.delete(id);

      console.log('GeofencingService: Geofence deleted:', id);

      // Emit event
      if (geofence) {
        gps51EventBus.emit('gps51.geofence.deleted', geofence, {
          source: 'geofencing_service',
          priority: 'normal'
        });
      }

    } catch (error) {
      console.error('GeofencingService: Error deleting geofence:', error);
      throw error;
    }
  }

  // Load geofences from database
  async loadGeofences(): Promise<void> {
    try {
      const { data: geofences, error } = await supabase
        .from('geofences')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // Convert database format to internal format
      geofences?.forEach(gf => {
        const geofence: Geofence = {
          id: gf.id,
          name: gf.name,
          description: gf.description,
          type: gf.type as 'circular' | 'polygon',
          isActive: gf.is_active,
          alertOnEntry: gf.alert_on_entry,
          alertOnExit: gf.alert_on_exit,
          alertOnViolation: gf.alert_on_violation,
          centerLat: gf.center_lat,
          centerLng: gf.center_lng,
          radius: gf.radius,
          coordinates: gf.coordinates as Array<{ lat: number; lng: number }>,
          createdAt: new Date(gf.created_at),
          updatedAt: new Date(gf.updated_at),
          createdBy: gf.created_by,
          tags: gf.tags,
          schedules: (gf.schedules as unknown) as GeofenceSchedule[]
        };

        this.geofences.set(geofence.id, geofence);
      });

      console.log('GeofencingService: Loaded', this.geofences.size, 'geofences');

    } catch (error) {
      console.error('GeofencingService: Error loading geofences:', error);
      throw error;
    }
  }

  // Position Monitoring
  async checkPosition(vehicleId: string, lat: number, lng: number, speed?: number): Promise<GeofenceEvent[]> {
    const events: GeofenceEvent[] = [];

    try {
      // Check each active geofence
      for (const geofence of this.geofences.values()) {
        if (!geofence.isActive) continue;

        // Check if position is inside geofence
        const isInside = this.isPositionInGeofence(lat, lng, geofence);
        const wasInside = this.wasVehicleInGeofence(vehicleId, geofence.id);

        // Detect entry
        if (isInside && !wasInside && geofence.alertOnEntry) {
          const event = await this.createGeofenceEvent('entry', geofence, vehicleId, lat, lng, speed);
          events.push(event);
        }

        // Detect exit
        if (!isInside && wasInside && geofence.alertOnExit) {
          const event = await this.createGeofenceEvent('exit', geofence, vehicleId, lat, lng, speed);
          events.push(event);
        }

        // Check for violations
        if (geofence.alertOnViolation) {
          const violations = await this.checkViolations(geofence, vehicleId, lat, lng, speed, isInside);
          events.push(...violations);
        }

        // Update vehicle state
        this.updateVehicleGeofenceState(vehicleId, geofence.id, isInside);
      }

      return events;

    } catch (error) {
      console.error('GeofencingService: Error checking position:', error);
      return [];
    }
  }

  private isPositionInGeofence(lat: number, lng: number, geofence: Geofence): boolean {
    if (geofence.type === 'circular') {
      if (!geofence.centerLat || !geofence.centerLng || !geofence.radius) return false;
      
      const distance = this.calculateDistance(lat, lng, geofence.centerLat, geofence.centerLng);
      return distance <= geofence.radius;
    } else if (geofence.type === 'polygon') {
      if (!geofence.coordinates || geofence.coordinates.length < 3) return false;
      
      return this.isPointInPolygon(lat, lng, geofence.coordinates);
    }

    return false;
  }

  private isPointInPolygon(lat: number, lng: number, coordinates: Array<{ lat: number; lng: number }>): boolean {
    let inside = false;
    
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
      const xi = coordinates[i].lat;
      const yi = coordinates[i].lng;
      const xj = coordinates[j].lat;
      const yj = coordinates[j].lng;
      
      if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Monitoring Control
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoringActive) {
      console.log('GeofencingService: Monitoring already active');
      return;
    }

    this.monitoringActive = true;
    
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCheck();
    }, intervalMs);

    console.log('GeofencingService: Monitoring started with', intervalMs, 'ms interval');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.monitoringActive = false;
    console.log('GeofencingService: Monitoring stopped');
  }

  private async performMonitoringCheck(): Promise<void> {
    try {
      // Get recent vehicle positions
      const { data: positions, error } = await supabase
        .from('vehicle_positions')
        .select('vehicle_id, latitude, longitude, speed, timestamp')
        .gte('timestamp', new Date(Date.now() - 60000).toISOString()) // Last minute
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by vehicle and get latest position for each
      const latestPositions = new Map<string, any>();
      positions?.forEach(pos => {
        if (!latestPositions.has(pos.vehicle_id) || 
            new Date(pos.timestamp) > new Date(latestPositions.get(pos.vehicle_id).timestamp)) {
          latestPositions.set(pos.vehicle_id, pos);
        }
      });

      // Check each vehicle's position against geofences
      for (const [vehicleId, position] of latestPositions) {
        const events = await this.checkPosition(
          vehicleId,
          position.latitude,
          position.longitude,
          position.speed
        );

        // Process events
        for (const event of events) {
          await this.processGeofenceEvent(event);
        }
      }

    } catch (error) {
      console.error('GeofencingService: Error in monitoring check:', error);
    }
  }

  // Event Processing
  private async createGeofenceEvent(
    type: 'entry' | 'exit' | 'violation',
    geofence: Geofence,
    vehicleId: string,
    lat: number,
    lng: number,
    speed?: number
  ): Promise<GeofenceEvent> {
    const event: GeofenceEvent = {
      id: this.generateId(),
      type,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      vehicleId,
      vehicleName: vehicleId, // This should be fetched from vehicle data
      timestamp: new Date(),
      location: { lat, lng },
      speed,
      acknowledged: false,
      severity: this.calculateEventSeverity(type, geofence),
      metadata: {
        geofenceType: geofence.type,
        tags: geofence.tags
      }
    };

    return event;
  }

  private async processGeofenceEvent(event: GeofenceEvent): Promise<void> {
    try {
      // Store event in database
      const { error } = await supabase
        .from('geofence_events')
        .insert({
          id: event.id,
          type: event.type,
          geofence_id: event.geofenceId,
          vehicle_id: event.vehicleId,
          timestamp: event.timestamp.toISOString(),
          location: event.location,
          speed: event.speed,
          severity: event.severity,
          acknowledged: event.acknowledged,
          metadata: event.metadata
        });

      if (error) throw error;

      // Add to memory
      this.events.push(event);

      // Emit real-time event
      gps51EventBus.emit(`gps51.geofence.${event.type}`, event, {
        source: 'geofencing_service',
        priority: event.severity === 'critical' ? 'high' : 'normal'
      });

      console.log('GeofencingService: Geofence event processed:', {
        type: event.type,
        geofence: event.geofenceName,
        vehicle: event.vehicleName,
        severity: event.severity
      });

    } catch (error) {
      console.error('GeofencingService: Error processing geofence event:', error);
    }
  }

  // Setup event listeners for real-time updates
  private setupEventListeners(): void {
    // Listen for position updates from GPS51 system
    gps51EventBus.on('gps51.positions.updated', async (event) => {
      if (this.monitoringActive && event.data) {
        const positions = Array.isArray(event.data) ? event.data : [event.data];
        
        for (const position of positions) {
          if (position.lat && position.lng && position.deviceId) {
            const events = await this.checkPosition(
              position.deviceId,
              position.lat,
              position.lng,
              position.speed
            );

            for (const geofenceEvent of events) {
              await this.processGeofenceEvent(geofenceEvent);
            }
          }
        }
      }
    });
  }

  // Utility methods
  private generateId(): string {
    return `gf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateGeofence(geofence: Geofence): void {
    if (!geofence.name || geofence.name.trim().length === 0) {
      throw new Error('Geofence name is required');
    }

    if (geofence.type === 'circular') {
      if (!geofence.centerLat || !geofence.centerLng || !geofence.radius) {
        throw new Error('Circular geofence requires center coordinates and radius');
      }
      if (geofence.radius <= 0) {
        throw new Error('Geofence radius must be positive');
      }
    } else if (geofence.type === 'polygon') {
      if (!geofence.coordinates || geofence.coordinates.length < 3) {
        throw new Error('Polygon geofence requires at least 3 coordinates');
      }
    }
  }

  private calculateEventSeverity(type: 'entry' | 'exit' | 'violation', geofence: Geofence): 'low' | 'medium' | 'high' | 'critical' {
    if (type === 'violation') return 'high';
    if (geofence.tags?.includes('critical')) return 'critical';
    if (geofence.tags?.includes('important')) return 'medium';
    return 'low';
  }

  private wasVehicleInGeofence(vehicleId: string, geofenceId: string): boolean {
    // This would typically be stored in a state management system
    // For now, we'll use a simple in-memory approach
    return false; // Simplified for demo
  }

  private updateVehicleGeofenceState(vehicleId: string, geofenceId: string, isInside: boolean): void {
    // Update vehicle state - this would typically use the state manager
    // Simplified for demo
  }

  private async checkViolations(
    geofence: Geofence,
    vehicleId: string,
    lat: number,
    lng: number,
    speed?: number,
    isInside?: boolean
  ): Promise<GeofenceEvent[]> {
    const violations: GeofenceEvent[] = [];

    // Check speed violations if vehicle is inside geofence
    if (isInside && speed && geofence.tags?.includes('speed_limit')) {
      const speedLimit = 50; // This should come from geofence metadata
      if (speed > speedLimit) {
        const violation = await this.createGeofenceEvent('violation', geofence, vehicleId, lat, lng, speed);
        violation.metadata = {
          ...violation.metadata,
          violationType: 'speeding',
          speedLimit,
          actualSpeed: speed
        };
        violations.push(violation);
      }
    }

    return violations;
  }

  // Public API methods
  getGeofences(): Geofence[] {
    return Array.from(this.geofences.values());
  }

  getGeofence(id: string): Geofence | null {
    return this.geofences.get(id) || null;
  }

  getEvents(limit: number = 50): GeofenceEvent[] {
    return this.events.slice(-limit);
  }

  async getStats(): Promise<GeofenceStats> {
    const totalGeofences = this.geofences.size;
    const activeGeofences = Array.from(this.geofences.values()).filter(gf => gf.isActive).length;
    const todayEvents = this.events.filter(e => 
      e.timestamp.toDateString() === new Date().toDateString()
    ).length;
    const violations = this.events.filter(e => e.type === 'violation').length;

    return {
      totalGeofences,
      activeGeofences,
      totalEvents: this.events.length,
      todayEvents,
      violations,
      topViolatingVehicle: 'Vehicle_001', // Simplified
      mostActiveGeofence: 'Warehouse_A' // Simplified
    };
  }

  destroy(): void {
    this.stopMonitoring();
    this.geofences.clear();
    this.events = [];
    console.log('GeofencingService: Destroyed');
  }
}

// Create singleton instance
export const geofencingService = new GeofencingService();