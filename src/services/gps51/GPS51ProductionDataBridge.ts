import { gps51UnifiedAuthService } from './GPS51UnifiedAuthService';
import { gps51LiveDataManager } from './GPS51LiveDataManager';
import { gps51ProductionHealthMonitor } from './GPS51ProductionHealthMonitor';

/**
 * Production-grade data bridge to ensure reliable dashboard data flow
 */
export class GPS51ProductionDataBridge {
  private static instance: GPS51ProductionDataBridge;
  private dashboardDataCache: any = null;
  private lastSuccessfulUpdate: Date | null = null;
  private isInitialized = false;

  static getInstance(): GPS51ProductionDataBridge {
    if (!GPS51ProductionDataBridge.instance) {
      GPS51ProductionDataBridge.instance = new GPS51ProductionDataBridge();
    }
    return GPS51ProductionDataBridge.instance;
  }

  /**
   * Initialize production data bridge with error recovery
   */
  async initializeDataBridge(): Promise<boolean> {
    try {
      console.log('GPS51ProductionDataBridge: Initializing production data bridge...');

      // Ensure authentication is ready
      const authStatus = gps51UnifiedAuthService.getAuthenticationStatus();
      if (!authStatus.isAuthenticated) {
        console.warn('GPS51ProductionDataBridge: Authentication not ready, attempting initialization...');
        const authResult = await gps51UnifiedAuthService.initializeAuthentication();
        if (!authResult) {
          throw new Error('Authentication initialization failed');
        }
      }

      // Initialize live data manager
      const liveDataInitialized = await gps51LiveDataManager.initializeLiveDataSystem();
      if (!liveDataInitialized) {
        console.warn('GPS51ProductionDataBridge: Live data manager initialization failed, using fallback mode');
      }

      // Set up event listeners for data updates
      this.setupEventListeners();

      // Trigger initial data load
      await this.triggerInitialDataLoad();

      this.isInitialized = true;
      console.log('GPS51ProductionDataBridge: Production data bridge initialized successfully');
      return true;
    } catch (error) {
      console.error('GPS51ProductionDataBridge: Initialization failed:', error);
      return false;
    }
  }

  /**
   * Set up event listeners for real-time data updates
   */
  private setupEventListeners(): void {
    // Listen for live data updates
    window.addEventListener('gps51-live-data-update', (event: any) => {
      const data = event.detail;
      this.updateDashboardData(data);
    });

    // Listen for authentication changes
    window.addEventListener('gps51-authentication-success', () => {
      console.log('GPS51ProductionDataBridge: Authentication success - refreshing data...');
      this.triggerDataRefresh();
    });

    // Listen for health updates
    window.addEventListener('gps51-health-update', (event: any) => {
      const healthData = event.detail;
      this.handleHealthUpdate(healthData);
    });

    console.log('GPS51ProductionDataBridge: Event listeners setup completed');
  }

  /**
   * Trigger initial data load with retries
   */
  private async triggerInitialDataLoad(): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`GPS51ProductionDataBridge: Initial data load attempt ${attempt + 1}/${maxRetries}`);
        
        const data = await gps51LiveDataManager.forceLiveDataSync();
        
        if (data.devices.length > 0) {
          this.updateDashboardData(data);
          console.log('GPS51ProductionDataBridge: Initial data load successful:', {
            devices: data.devices.length,
            positions: data.positions.length
          });
          return;
        } else {
          console.warn('GPS51ProductionDataBridge: Initial data load returned empty result');
        }
      } catch (error) {
        console.error(`GPS51ProductionDataBridge: Initial data load attempt ${attempt + 1} failed:`, error);
      }
      
      attempt++;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`GPS51ProductionDataBridge: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.warn('GPS51ProductionDataBridge: All initial data load attempts failed');
  }

  /**
   * Update dashboard data cache and dispatch events
   */
  private updateDashboardData(data: any): void {
    this.dashboardDataCache = {
      ...data,
      lastUpdate: new Date(),
      productionReady: true
    };
    
    this.lastSuccessfulUpdate = new Date();

    // Dispatch dashboard-specific event
    window.dispatchEvent(new CustomEvent('gps51-dashboard-data-update', {
      detail: this.dashboardDataCache
    }));

    console.log('GPS51ProductionDataBridge: Dashboard data updated:', {
      devices: data.devices?.length || 0,
      positions: data.positions?.length || 0,
      timestamp: this.lastSuccessfulUpdate.toISOString()
    });
  }

  /**
   * Handle health updates and take corrective actions
   */
  private handleHealthUpdate(healthData: any): void {
    if (healthData.overallStatus !== 'Operational') {
      console.warn('GPS51ProductionDataBridge: Health issue detected:', healthData.overallStatus);
      
      // Try to recover if authentication failed
      if (healthData.components?.authentication?.status === 'Failed') {
        console.log('GPS51ProductionDataBridge: Authentication failure detected - attempting recovery...');
        this.triggerAuthenticationRecovery();
      }
    }
  }

  /**
   * Trigger authentication recovery
   */
  private async triggerAuthenticationRecovery(): Promise<void> {
    try {
      console.log('GPS51ProductionDataBridge: Starting authentication recovery...');
      const recovered = await gps51UnifiedAuthService.refreshAuthentication();
      
      if (recovered) {
        console.log('GPS51ProductionDataBridge: Authentication recovery successful');
        // Trigger data refresh after recovery
        await this.triggerDataRefresh();
      } else {
        console.error('GPS51ProductionDataBridge: Authentication recovery failed');
      }
    } catch (error) {
      console.error('GPS51ProductionDataBridge: Authentication recovery error:', error);
    }
  }

  /**
   * Trigger manual data refresh
   */
  async triggerDataRefresh(): Promise<void> {
    try {
      console.log('GPS51ProductionDataBridge: Manual data refresh triggered...');
      const data = await gps51LiveDataManager.forceLiveDataSync();
      this.updateDashboardData(data);
    } catch (error) {
      console.error('GPS51ProductionDataBridge: Manual data refresh failed:', error);
    }
  }

  /**
   * Get cached dashboard data
   */
  getDashboardData(): any {
    return this.dashboardDataCache;
  }

  /**
   * Check if data bridge is ready
   */
  isReady(): boolean {
    return this.isInitialized && !!this.dashboardDataCache;
  }

  /**
   * Get data freshness status
   */
  getDataFreshness(): {
    isStale: boolean;
    lastUpdate: Date | null;
    minutesSinceUpdate: number;
  } {
    const now = new Date();
    const minutesSinceUpdate = this.lastSuccessfulUpdate 
      ? Math.floor((now.getTime() - this.lastSuccessfulUpdate.getTime()) / (1000 * 60))
      : Infinity;

    return {
      isStale: minutesSinceUpdate > 5, // Data is stale after 5 minutes
      lastUpdate: this.lastSuccessfulUpdate,
      minutesSinceUpdate
    };
  }

  /**
   * Reset data bridge
   */
  reset(): void {
    this.dashboardDataCache = null;
    this.lastSuccessfulUpdate = null;
    this.isInitialized = false;
    console.log('GPS51ProductionDataBridge: Data bridge reset');
  }
}

export const gps51ProductionDataBridge = GPS51ProductionDataBridge.getInstance();