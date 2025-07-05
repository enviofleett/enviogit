// GPS51 Geofence Integration - Phase 3: Enhanced Geofencing Integration
// Provides bidirectional sync between local geofences and GPS51 backend

import { gps51Client } from './GPS51Client';
import { GPS51_STATUS } from './GPS51Constants';
import { GeofencingService, Geofence } from '../geofencing/GeofencingService';

export interface GPS51Geofence {
  id: string;
  name: string;
  categoryId: number;
  type: number; // 1: Circle, 2: Rectangle, 3: Polygon
  useAs: number; // 0: Enter/exit notification, 1: Speed limit, 2: Time restriction
  triggerEvent: number; // 0: Platform notify, 1: SMS, 2: Email
  lat1: number;
  lon1: number;
  radius1?: number; // For circular geofences
  lat2?: number; // For rectangular geofences
  lon2?: number;
  points?: Array<{ lat: number; lon: number }>; // For polygon geofences
  speedLimit?: number;
  timeRestriction?: {
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
  };
}

export interface GeofenceSyncResult {
  success: boolean;
  localGeofences: number;
  remoteGeofences: number;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export class GPS51GeofenceIntegration {
  private geofencingService: GeofencingService;
  private syncInProgress = false;

  constructor(geofencingService: GeofencingService) {
    this.geofencingService = geofencingService;
  }

  /**
   * Create geofence on GPS51 backend
   */
  async createRemoteGeofence(geofence: Geofence): Promise<{ success: boolean; remoteId?: string; error?: string }> {
    try {
      console.log('GPS51GeofenceIntegration: Creating remote geofence:', geofence.name);

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      // Convert local geofence to GPS51 format
      const gps51Geofence = this.convertToGPS51Format(geofence);

      const response = await gps51Client['apiClient'].makeRequest('addgeosystemrecord', gps51Client.getToken()!, {
        name: gps51Geofence.name,
        categoryid: gps51Geofence.categoryId,
        type: gps51Geofence.type,
        useas: gps51Geofence.useAs,
        triggerevent: gps51Geofence.triggerEvent,
        lat1: gps51Geofence.lat1,
        lon1: gps51Geofence.lon1,
        radius1: gps51Geofence.radius1,
        lat2: gps51Geofence.lat2,
        lon2: gps51Geofence.lon2,
        points: gps51Geofence.points,
        speedlimit: gps51Geofence.speedLimit,
        timerestriction: gps51Geofence.timeRestriction
      });

      console.log('GPS51GeofenceIntegration: Create geofence response:', {
        status: response.status,
        message: response.message,
        hasId: !!response.id
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        const remoteId = response.id || response.geofenceid;
        
        console.log('GPS51GeofenceIntegration: Remote geofence created:', {
          localId: geofence.id,
          remoteId,
          name: geofence.name
        });

        return {
          success: true,
          remoteId
        };

      } else {
        const errorMessage = response.cause || response.message || 'Failed to create remote geofence';
        console.error('GPS51GeofenceIntegration: Failed to create remote geofence:', errorMessage);
        
        return {
          success: false,
          error: errorMessage
        };
      }

    } catch (error) {
      console.error('GPS51GeofenceIntegration: Error creating remote geofence:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all geofences from GPS51 backend
   */
  async getRemoteGeofences(): Promise<GPS51Geofence[]> {
    try {
      console.log('GPS51GeofenceIntegration: Fetching remote geofences');

      // Ensure client is authenticated
      if (!gps51Client.isAuthenticated()) {
        throw new Error('GPS51 client not authenticated');
      }

      const response = await gps51Client['apiClient'].makeRequest('querygeosystemrecords', gps51Client.getToken()!, {});

      console.log('GPS51GeofenceIntegration: Remote geofences response:', {
        status: response.status,
        hasData: !!response.data,
        hasRecords: !!response.records,
        dataLength: Array.isArray(response.data) ? response.data.length : 0
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        const rawData = response.data || response.records || [];
        
        if (!Array.isArray(rawData)) {
          console.warn('GPS51GeofenceIntegration: No valid geofences data received');
          return [];
        }

        const geofences = rawData.map(this.convertFromGPS51Format);
        
        console.log('GPS51GeofenceIntegration: Successfully retrieved', geofences.length, 'remote geofences');
        return geofences;

      } else {
        const errorMessage = response.cause || response.message || `Failed to fetch remote geofences - Status: ${response.status}`;
        console.error('GPS51GeofenceIntegration: Remote geofences error:', errorMessage);
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('GPS51GeofenceIntegration: Error fetching remote geofences:', error);
      throw error;
    }
  }

  /**
   * Sync geofences between local and remote
   */
  async syncGeofences(): Promise<GeofenceSyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        localGeofences: 0,
        remoteGeofences: 0,
        synced: 0,
        created: 0,
        updated: 0,
        errors: ['Sync already in progress']
      };
    }

    try {
      this.syncInProgress = true;
      
      console.log('GPS51GeofenceIntegration: Starting geofence sync');

      // Load local geofences
      await this.geofencingService.loadGeofences();
      
      // Get remote geofences
      const remoteGeofences = await this.getRemoteGeofences();
      
      const result: GeofenceSyncResult = {
        success: true,
        localGeofences: 0, // Will be updated by geofencing service
        remoteGeofences: remoteGeofences.length,
        synced: 0,
        created: 0,
        updated: 0,
        errors: []
      };

      // Convert remote geofences to local format and create/update
      for (const remoteGeofence of remoteGeofences) {
        try {
          const localGeofence = this.convertToLocalFormat(remoteGeofence);
          
          // Check if geofence already exists locally
          // This would require extending the GeofencingService to check existence
          // For now, we'll assume all remote geofences should be created locally
          
          const geofence = await this.geofencingService.createGeofence({
            name: localGeofence.name,
            description: localGeofence.description,
            type: localGeofence.type,
            coordinates: localGeofence.coordinates,
            radius: localGeofence.radius,
            is_active: localGeofence.is_active,
            alert_on_entry: localGeofence.alert_on_entry,
            alert_on_exit: localGeofence.alert_on_exit,
            alert_on_violation: localGeofence.alert_on_violation
          });

          result.created++;
          result.synced++;
          
          console.log('GPS51GeofenceIntegration: Created local geofence from remote:', {
            remoteId: remoteGeofence.id,
            localId: geofence?.id,
            name: remoteGeofence.name
          });

        } catch (error) {
          const errorMessage = `Failed to sync geofence ${remoteGeofence.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          console.error('GPS51GeofenceIntegration: Sync error for geofence:', errorMessage);
        }
      }

      console.log('GPS51GeofenceIntegration: Sync completed:', {
        remoteGeofences: result.remoteGeofences,
        created: result.created,
        errors: result.errors.length
      });

      return result;

    } catch (error) {
      console.error('GPS51GeofenceIntegration: Sync failed:', error);
      
      return {
        success: false,
        localGeofences: 0,
        remoteGeofences: 0,
        synced: 0,
        created: 0,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  private convertToGPS51Format(geofence: Geofence): GPS51Geofence {
    return {
      id: geofence.id,
      name: geofence.name,
      categoryId: 1, // Default category
      type: geofence.type === 'circle' ? 1 : 3, // 1: Circle, 3: Polygon
      useAs: 0, // Enter/exit notification
      triggerEvent: 0, // Platform notify
      lat1: geofence.coordinates?.[0]?.[0] ?? 0,
      lon1: geofence.coordinates?.[0]?.[1] ?? 0,
      radius1: geofence.radius,
      points: geofence.coordinates?.map(coord => ({ lat: coord[0], lon: coord[1] }))
    };
  }

  private convertFromGPS51Format(gps51Geofence: any): GPS51Geofence {
    return {
      id: gps51Geofence.id || gps51Geofence.geofenceid,
      name: gps51Geofence.name,
      categoryId: gps51Geofence.categoryid || 1,
      type: gps51Geofence.type || 1,
      useAs: gps51Geofence.useas || 0,
      triggerEvent: gps51Geofence.triggerevent || 0,
      lat1: gps51Geofence.lat1,
      lon1: gps51Geofence.lon1,
      radius1: gps51Geofence.radius1,
      lat2: gps51Geofence.lat2,
      lon2: gps51Geofence.lon2,
      points: gps51Geofence.points,
      speedLimit: gps51Geofence.speedlimit,
      timeRestriction: gps51Geofence.timerestriction
    };
  }

  private convertToLocalFormat(gps51Geofence: GPS51Geofence): Omit<Geofence, 'id' | 'created_at' | 'updated_at'> {
    const isCircular = gps51Geofence.type === 1;
    
    return {
      name: gps51Geofence.name,
      description: `Synced from GPS51 (ID: ${gps51Geofence.id})`,
      type: isCircular ? 'circle' : 'polygon',
      is_active: true,
      alert_on_entry: true,
      alert_on_exit: true,
      alert_on_violation: false,
      coordinates: isCircular 
        ? [[gps51Geofence.lat1, gps51Geofence.lon1]]
        : gps51Geofence.points?.map(p => [p.lat, p.lon]) || [],
      radius: isCircular ? gps51Geofence.radius1 : undefined
    };
  }
}

export const gps51GeofenceIntegration = new GPS51GeofenceIntegration(new GeofencingService());