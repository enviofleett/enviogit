// GPS51 Geofence Manager - Phase 3.1
// Provides geofence creation, management, and GPS51 integration

import { geofencingService, Geofence, GeofenceEvent } from '../geofencing/GeofencingService';
import { gps51ApiClient } from './client';
import { gps51EventBus } from './realtime';

export interface GPS51GeofenceConfig {
  name: string;
  description?: string;
  type: 'circular' | 'polygon';
  alertOnEntry: boolean;
  alertOnExit: boolean;
  alertOnViolation: boolean;
  // Circular geofence
  centerLat?: number;
  centerLng?: number;
  radius?: number;
  // Polygon geofence
  coordinates?: Array<{ lat: number; lng: number }>;
  tags?: string[];
  syncWithGPS51?: boolean;
}

export interface GPS51GeofenceStatus {
  localId: string;
  gps51Id?: string;
  syncStatus: 'pending' | 'synced' | 'error';
  lastSync?: Date;
  errorMessage?: string;
}

export class GPS51GeofenceManager {
  private geofenceStatuses = new Map<string, GPS51GeofenceStatus>();
  private syncInProgress = false;

  constructor() {
    this.setupEventListeners();
  }

  // Geofence Creation and Management
  async createGeofence(config: GPS51GeofenceConfig): Promise<string> {
    try {
      // Create local geofence first
      const geofenceId = await geofencingService.createGeofence({
        name: config.name,
        description: config.description,
        type: config.type,
        isActive: true,
        alertOnEntry: config.alertOnEntry,
        alertOnExit: config.alertOnExit,
        alertOnViolation: config.alertOnViolation,
        centerLat: config.centerLat,
        centerLng: config.centerLng,
        radius: config.radius,
        coordinates: config.coordinates,
        createdBy: 'system', // This should be from auth context
        tags: config.tags
      });

      // Track sync status
      this.geofenceStatuses.set(geofenceId, {
        localId: geofenceId,
        syncStatus: 'pending'
      });

      // Sync with GPS51 if requested
      if (config.syncWithGPS51) {
        await this.syncGeofenceWithGPS51(geofenceId);
      }

      console.log('GPS51GeofenceManager: Geofence created:', geofenceId);
      return geofenceId;

    } catch (error) {
      console.error('GPS51GeofenceManager: Error creating geofence:', error);
      throw error;
    }
  }

  async updateGeofence(id: string, updates: Partial<GPS51GeofenceConfig>): Promise<void> {
    try {
      await geofencingService.updateGeofence(id, {
        name: updates.name,
        description: updates.description,
        alertOnEntry: updates.alertOnEntry,
        alertOnExit: updates.alertOnExit,
        alertOnViolation: updates.alertOnViolation,
        centerLat: updates.centerLat,
        centerLng: updates.centerLng,
        radius: updates.radius,
        coordinates: updates.coordinates,
        tags: updates.tags
      });

      // Update sync status
      const status = this.geofenceStatuses.get(id);
      if (status) {
        status.syncStatus = 'pending';
        this.geofenceStatuses.set(id, status);
      }

      // Re-sync with GPS51 if it was previously synced
      if (status?.gps51Id && updates.syncWithGPS51) {
        await this.syncGeofenceWithGPS51(id);
      }

      console.log('GPS51GeofenceManager: Geofence updated:', id);

    } catch (error) {
      console.error('GPS51GeofenceManager: Error updating geofence:', error);
      throw error;
    }
  }

  async deleteGeofence(id: string): Promise<void> {
    try {
      const status = this.geofenceStatuses.get(id);
      
      // Remove from GPS51 if synced
      if (status?.gps51Id) {
        await this.removeGeofenceFromGPS51(status.gps51Id);
      }

      // Remove local geofence
      await geofencingService.deleteGeofence(id);
      
      // Clean up status tracking
      this.geofenceStatuses.delete(id);

      console.log('GPS51GeofenceManager: Geofence deleted:', id);

    } catch (error) {
      console.error('GPS51GeofenceManager: Error deleting geofence:', error);
      throw error;
    }
  }

  // GPS51 Integration
  async syncGeofenceWithGPS51(geofenceId: string): Promise<void> {
    try {
      const geofence = geofencingService.getGeofence(geofenceId);
      if (!geofence) {
        throw new Error(`Geofence ${geofenceId} not found`);
      }

      // Convert to GPS51 format
      const gps51Geofence = this.convertToGPS51Format(geofence);
      
      // Send to GPS51 API
      const response = await gps51ApiClient.createGeofence(gps51Geofence);
      
      // Update sync status
      this.geofenceStatuses.set(geofenceId, {
        localId: geofenceId,
        gps51Id: response.id,
        syncStatus: 'synced',
        lastSync: new Date()
      });

      console.log('GPS51GeofenceManager: Geofence synced with GPS51:', geofenceId, response.id);

    } catch (error) {
      console.error('GPS51GeofenceManager: Error syncing with GPS51:', error);
      
      // Update error status
      const status = this.geofenceStatuses.get(geofenceId);
      if (status) {
        status.syncStatus = 'error';
        status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.geofenceStatuses.set(geofenceId, status);
      }
      
      throw error;
    }
  }

  async removeGeofenceFromGPS51(gps51Id: string): Promise<void> {
    try {
      await gps51ApiClient.deleteGeofence(gps51Id);
      console.log('GPS51GeofenceManager: Geofence removed from GPS51:', gps51Id);
    } catch (error) {
      console.error('GPS51GeofenceManager: Error removing from GPS51:', error);
      // Don't throw here as we want to continue with local deletion
    }
  }

  async syncAllGeofences(): Promise<void> {
    if (this.syncInProgress) {
      console.log('GPS51GeofenceManager: Sync already in progress');
      return;
    }

    this.syncInProgress = true;
    
    try {
      const geofences = geofencingService.getGeofences();
      const syncPromises = geofences.map(async (geofence) => {
        const status = this.geofenceStatuses.get(geofence.id);
        if (!status || status.syncStatus === 'pending' || status.syncStatus === 'error') {
          await this.syncGeofenceWithGPS51(geofence.id);
        }
      });

      await Promise.allSettled(syncPromises);
      console.log('GPS51GeofenceManager: All geofences sync completed');

    } catch (error) {
      console.error('GPS51GeofenceManager: Error in bulk sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Utility Methods
  private convertToGPS51Format(geofence: Geofence): any {
    return {
      name: geofence.name,
      description: geofence.description,
      type: geofence.type,
      active: geofence.isActive,
      alertEntry: geofence.alertOnEntry,
      alertExit: geofence.alertOnExit,
      alertViolation: geofence.alertOnViolation,
      centerLat: geofence.centerLat,
      centerLng: geofence.centerLng,
      radius: geofence.radius,
      coordinates: geofence.coordinates,
      tags: geofence.tags
    };
  }

  private setupEventListeners(): void {
    // Listen for geofence events and forward to GPS51 if needed
    gps51EventBus.on('gps51.geofence.entry', async (event) => {
      await this.handleGeofenceEvent(event.data, 'entry');
    });

    gps51EventBus.on('gps51.geofence.exit', async (event) => {
      await this.handleGeofenceEvent(event.data, 'exit');
    });

    gps51EventBus.on('gps51.geofence.violation', async (event) => {
      await this.handleGeofenceEvent(event.data, 'violation');
    });
  }

  private async handleGeofenceEvent(event: GeofenceEvent, type: string): Promise<void> {
    try {
      const status = this.geofenceStatuses.get(event.geofenceId);
      
      // Forward to GPS51 if synced
      if (status?.gps51Id) {
        await gps51ApiClient.reportGeofenceEvent({
          geofenceId: status.gps51Id,
          vehicleId: event.vehicleId,
          type: type,
          timestamp: event.timestamp,
          location: event.location,
          speed: event.speed,
          metadata: event.metadata
        });
      }

      console.log('GPS51GeofenceManager: Event forwarded to GPS51:', type, event.geofenceId);

    } catch (error) {
      console.error('GPS51GeofenceManager: Error forwarding event to GPS51:', error);
    }
  }

  // Public API
  getGeofenceStatus(id: string): GPS51GeofenceStatus | null {
    return this.geofenceStatuses.get(id) || null;
  }

  getAllGeofenceStatuses(): Map<string, GPS51GeofenceStatus> {
    return new Map(this.geofenceStatuses);
  }

  getGeofences(): Geofence[] {
    return geofencingService.getGeofences();
  }

  getGeofence(id: string): Geofence | null {
    return geofencingService.getGeofence(id);
  }

  async getGeofenceStats() {
    return await geofencingService.getStats();
  }

  destroy(): void {
    this.geofenceStatuses.clear();
    console.log('GPS51GeofenceManager: Destroyed');
  }
}

// Create singleton instance
export const gps51GeofenceManager = new GPS51GeofenceManager();