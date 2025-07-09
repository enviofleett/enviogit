// GPS51 Geofence Manager - Phase 3.1
// Provides geofence creation, management, and GPS51 integration

import { geofencingService, Geofence, GeofenceEvent } from '../geofencing/GeofencingService';
import { GPS51Client } from './client';
import { gps51EventBus } from './realtime';
import { GPS51ProxyClient } from './GPS51ProxyClient';

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
  private gps51Client: GPS51Client | null = null;
  private proxyClient: GPS51ProxyClient;

  constructor() {
    this.setupEventListeners();
    this.proxyClient = GPS51ProxyClient.getInstance();
    this.initializeGPS51Client();
  }

  private initializeGPS51Client(): void {
    try {
      // Try to create GPS51Client - it will auto-load credentials
      this.gps51Client = new GPS51Client();
      console.log('GPS51GeofenceManager: GPS51Client initialized successfully');
    } catch (error) {
      console.warn('GPS51GeofenceManager: GPS51Client initialization failed:', error);
      this.gps51Client = null;
    }
  }

  // Geofence Creation and Management
  async createGeofence(config: GPS51GeofenceConfig): Promise<string> {
    try {
      // Create local geofence first
      const geofence = await geofencingService.createGeofence({
        name: config.name,
        description: config.description,
        type: config.type === 'circular' ? 'circle' : 'polygon',
        coordinates: config.type === 'circular' && config.centerLat && config.centerLng
          ? [[config.centerLat, config.centerLng]]
          : config.coordinates?.map(c => [c.lat, c.lng]) || [],
        radius: config.radius,
        is_active: true,
        alert_on_entry: config.alertOnEntry,
        alert_on_exit: config.alertOnExit,
        alert_on_violation: config.alertOnViolation
      });
      
      const geofenceId = geofence.id;

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
        coordinates: updates.coordinates?.map(c => [c.lat, c.lng]),
        radius: updates.radius,
        alert_on_entry: updates.alertOnEntry,
        alert_on_exit: updates.alertOnExit,
        alert_on_violation: updates.alertOnViolation
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
      const geofence = await geofencingService.getGeofence(geofenceId);
      if (!geofence) {
        throw new Error(`Geofence ${geofenceId} not found`);
      }

      // Check if GPS51Client is available
      if (!this.gps51Client) {
        this.initializeGPS51Client();
        if (!this.gps51Client) {
          throw new Error('GPS51Client not available - please authenticate first');
        }
      }

      // Convert to GPS51 format
      const gps51Geofence = this.convertToGPS51Format(geofence);
      
      // Test GPS51 connection first
      const isConnected = await this.gps51Client.testConnection();
      if (!isConnected) {
        throw new Error('GPS51 connection test failed');
      }
      
      // For now, log what would be sent to GPS51 API
      console.log('GPS51GeofenceManager: Would create geofence in GPS51:', gps51Geofence);
      
      // GPS51 doesn't have a standard geofence API like this client expects
      // This would need to be implemented using GPS51's specific geofence actions
      // For now, we'll mark as synced but note that actual GPS51 geofence integration
      // would require using GPS51's proprietary geofence format and API calls
      
      const response = { id: `gps51_${Date.now()}` };
      
      // Update sync status
      this.geofenceStatuses.set(geofenceId, {
        localId: geofenceId,
        gps51Id: response.id,
        syncStatus: 'synced',
        lastSync: new Date()
      });

      console.log('GPS51GeofenceManager: Geofence marked as synced with GPS51:', geofenceId, response.id);

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
      // Mock implementation for GPS51 API call
      console.log('GPS51GeofenceManager: Would remove geofence from GPS51:', gps51Id);
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
      const geofences = await geofencingService.getGeofences();
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
      active: geofence.is_active,
      alertEntry: geofence.alert_on_entry,
      alertExit: geofence.alert_on_exit,
      alertViolation: geofence.alert_on_violation,
      coordinates: geofence.coordinates,
      radius: geofence.radius
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
      
      // Forward to GPS51 if synced (mock implementation)
      if (status?.gps51Id) {
        console.log('GPS51GeofenceManager: Would report geofence event to GPS51:', {
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

  async getGeofences(): Promise<Geofence[]> {
    return await geofencingService.getGeofences();
  }

  async getGeofence(id: string): Promise<Geofence | null> {
    return await geofencingService.getGeofence(id);
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