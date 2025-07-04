import { gps51EnhancedSyncService } from './GPS51EnhancedSyncService';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { gps51DatabaseIntegration } from './GPS51DatabaseIntegration';
import type { EnhancedLiveDataState } from './GPS51EnhancedStateManager';

export interface LiveDataManagerStatus {
  isActive: boolean;
  isAuthenticated: boolean;
  connectionHealth: 'good' | 'degraded' | 'poor';
  lastUpdate: Date | null;
  deviceCount: number;
  positionCount: number;
  databaseSyncEnabled: boolean;
  lastDatabaseSync: Date | null;
  errors: string[];
}

export class GPS51LiveDataManager {
  private static instance: GPS51LiveDataManager;
  private isPolling = false;
  private pollingCallback?: (data: EnhancedLiveDataState) => void;

  static getInstance(): GPS51LiveDataManager {
    if (!GPS51LiveDataManager.instance) {
      GPS51LiveDataManager.instance = new GPS51LiveDataManager();
    }
    return GPS51LiveDataManager.instance;
  }

  /**
   * Initialize the live data system with proper authentication and connection management
   */
  async initializeLiveDataSystem(): Promise<boolean> {
    try {
      console.log('GPS51LiveDataManager: Initializing live data system...');

      // Step 1: Test connection health
      const connectionTest = await gps51IntelligentConnectionManager.testAllConnections();
      const hasWorkingConnection = Array.from(connectionTest.values()).some(result => result.success);
      
      if (!hasWorkingConnection) {
        console.warn('GPS51LiveDataManager: No working connections available');
        return false;
      }

      // Step 2: Start enhanced sync service
      if (!this.isPolling) {
        console.log('GPS51LiveDataManager: Starting enhanced live data polling...');
        this.startEnhancedPolling();
      }

      console.log('GPS51LiveDataManager: Live data system initialized successfully');
      return true;
    } catch (error) {
      console.error('GPS51LiveDataManager: Failed to initialize live data system:', error);
      return false;
    }
  }

  /**
   * Start enhanced polling with callback and database integration
   */
  startEnhancedPolling(callback?: (data: EnhancedLiveDataState) => void): void {
    if (this.isPolling) {
      console.log('GPS51LiveDataManager: Polling already active');
      return;
    }

    this.pollingCallback = callback;
    this.isPolling = true;

    console.log('GPS51LiveDataManager: Starting enhanced polling with database integration...');

    // Use the enhanced sync service with comprehensive data processing
    gps51EnhancedSyncService.startEnhancedPolling(async (data) => {
      console.log('GPS51LiveDataManager: Live data update received:', {
        devices: data.devices.length,
        positions: data.positions.length,
        lastUpdate: data.lastUpdate
      });

      // Sync to database if we have meaningful data
      if (data.devices.length > 0) {
        try {
          const syncResult = await gps51DatabaseIntegration.syncToDatabase(data);
          console.log('GPS51LiveDataManager: Database sync completed:', {
            success: syncResult.success,
            vehiclesProcessed: syncResult.vehiclesProcessed,
            positionsStored: syncResult.positionsStored,
            executionTime: `${syncResult.executionTime}ms`
          });
        } catch (syncError) {
          console.warn('GPS51LiveDataManager: Database sync failed:', syncError);
        }
      }

      // Dispatch custom event for dashboard updates
      window.dispatchEvent(new CustomEvent('gps51-live-data-update', { 
        detail: data 
      }));

      // Call callback if provided
      if (this.pollingCallback) {
        this.pollingCallback(data);
      }

      // Call the original callback if provided
      if (callback) {
        callback(data);
      }
    });

    console.log('GPS51LiveDataManager: Enhanced polling with database integration started');
  }

  /**
   * Stop live data polling
   */
  stopPolling(): void {
    if (!this.isPolling) {
      return;
    }

    console.log('GPS51LiveDataManager: Stopping live data polling...');
    gps51EnhancedSyncService.stopEnhancedPolling();
    this.isPolling = false;
    this.pollingCallback = undefined;
    console.log('GPS51LiveDataManager: Live data polling stopped');
  }

  /**
   * Get current live data status with database sync information
   */
  getStatus(): LiveDataManagerStatus {
    const syncService = gps51EnhancedSyncService;
    const currentState = syncService.getCurrentEnhancedState();
    const serviceStatus = syncService.getEnhancedServiceStatus();
    const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();

    return {
      isActive: this.isPolling && serviceStatus.polling.isActive,
      isAuthenticated: true, // Always authenticated through intelligent connection manager
      connectionHealth: connectionHealth.overallHealth,
      lastUpdate: currentState.lastUpdate,
      deviceCount: currentState.devices.length,
      positionCount: currentState.positions.length,
      databaseSyncEnabled: true,
      lastDatabaseSync: currentState.lastUpdate,
      errors: []
    };
  }

  /**
   * Get current live data state
   */
  getCurrentState(): EnhancedLiveDataState {
    return gps51EnhancedSyncService.getCurrentEnhancedState();
  }

  /**
   * Force a manual sync with database integration
   */
  async forceLiveDataSync(): Promise<EnhancedLiveDataState> {
    try {
      console.log('GPS51LiveDataManager: Manual sync with database integration requested...');
      
      // Test connection health first
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      if (connectionHealth.overallHealth === 'poor') {
        throw new Error('No healthy connections available for sync');
      }

      // Fetch fresh data
      const data = await gps51EnhancedSyncService.fetchEnhancedLiveData();
      
      console.log('GPS51LiveDataManager: Manual sync completed:', {
        devices: data.devices.length,
        positions: data.positions.length
      });

      // Sync to database
      if (data.devices.length > 0) {
        try {
          const syncResult = await gps51DatabaseIntegration.syncToDatabase(data);
          console.log('GPS51LiveDataManager: Manual database sync completed:', {
            success: syncResult.success,
            vehiclesProcessed: syncResult.vehiclesProcessed,
            positionsStored: syncResult.positionsStored
          });
        } catch (syncError) {
          console.warn('GPS51LiveDataManager: Manual database sync failed:', syncError);
        }
      }

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('gps51-live-data-update', { 
        detail: data 
      }));

      return data;
    } catch (error) {
      console.error('GPS51LiveDataManager: Manual sync failed:', error);
      throw error;
    }
  }

  /**
   * Reset the entire live data system
   */
  async resetSystem(): Promise<void> {
    console.log('GPS51LiveDataManager: Resetting live data system...');
    
    this.stopPolling();
    gps51EnhancedSyncService.resetEnhancedService();
    gps51IntelligentConnectionManager.resetHealthTracking();
    
    console.log('GPS51LiveDataManager: System reset completed');
  }

  /**
   * Get comprehensive diagnostic information with database status
   */
  getDiagnosticInfo() {
    return {
      manager: {
        isPolling: this.isPolling,
        hasCallback: !!this.pollingCallback
      },
      syncService: gps51EnhancedSyncService.exportDebugInfo(),
      connection: gps51IntelligentConnectionManager.getConnectionHealth(),
      database: {
        integrationEnabled: true,
        canTestConnection: true
      }
    };
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnection(): Promise<{ success: boolean; error?: string }> {
    return gps51DatabaseIntegration.testDatabaseConnection();
  }

  /**
   * Get database sync statistics
   */
  async getDatabaseSyncStats() {
    return gps51DatabaseIntegration.getSyncJobStats();
  }
}

export const gps51LiveDataManager = GPS51LiveDataManager.getInstance();