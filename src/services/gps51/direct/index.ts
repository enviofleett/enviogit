// GPS51 Direct Integration Services - Phase 1 Core Services
// This module provides direct integration with GPS51 API without Supabase dependencies

import { GPS51DirectAuthService } from './GPS51DirectAuthService';
import { GPS51DirectVehicleService } from './GPS51DirectVehicleService';
import { GPS51DirectPositionService } from './GPS51DirectPositionService';
import type { GPS51AuthCredentials } from '../GPS51Types';

export { GPS51DirectAuthService } from './GPS51DirectAuthService';
export { GPS51EnhancedApiClient } from './GPS51EnhancedApiClient';
export { GPS51DirectVehicleService } from './GPS51DirectVehicleService';
export { GPS51DirectPositionService } from './GPS51DirectPositionService';

// Enhanced types and interfaces
export * from './GPS51DirectDataTypes';

// Re-export core types for convenience
export type {
  GPS51AuthCredentials,
  GPS51User,
  GPS51Device,
  GPS51Position,
  GPS51Group,
  GPS51ApiResponse
} from '../GPS51Types';

export type {
  GPS51AuthResult,
  GPS51AuthState
} from './GPS51DirectAuthService';

export type {
  RequestOptions,
  RequestMetrics
} from './GPS51EnhancedApiClient';

export type {
  VehicleServiceOptions,
  VehicleQueryResult,
  VehicleStats
} from './GPS51DirectVehicleService';

export type {
  PositionServiceOptions,
  PositionQueryResult,
  PositionFilter,
  PollingState
} from './GPS51DirectPositionService';

// Create a centralized GPS51 Direct Manager for easy integration
export class GPS51DirectManager {
  public auth: GPS51DirectAuthService;
  public vehicles: GPS51DirectVehicleService;
  public positions: GPS51DirectPositionService;

  constructor(baseURL?: string) {
    this.auth = new GPS51DirectAuthService(baseURL);
    this.vehicles = new GPS51DirectVehicleService(this.auth);
    this.positions = new GPS51DirectPositionService(this.auth);
  }

  // Convenience methods
  async initialize(credentials: GPS51AuthCredentials) {
    const authResult = await this.auth.authenticate(credentials);
    if (!authResult.success) {
      throw new Error(authResult.error || 'Authentication failed');
    }
    return authResult;
  }

  isReady(): boolean {
    return this.auth.isAuthenticated();
  }

  async getSystemHealth() {
    if (!this.isReady()) {
      return {
        status: 'not_authenticated',
        auth: false,
        vehicles: false,
        positions: false
      };
    }

    try {
      const [authHealth, vehicleTest, positionTest] = await Promise.allSettled([
        this.auth.testConnection(),
        this.vehicles.getVehicleList().then(() => true).catch(() => false),
        this.positions.getRealtimePositions([]).then(() => true).catch(() => false)
      ]);

      return {
        status: 'ready',
        auth: authHealth.status === 'fulfilled' && authHealth.value.success,
        vehicles: vehicleTest.status === 'fulfilled' && vehicleTest.value,
        positions: positionTest.status === 'fulfilled' && positionTest.value
      };
    } catch (error) {
      return {
        status: 'error',
        auth: false,
        vehicles: false,
        positions: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  shutdown(): void {
    this.auth.logout();
    this.vehicles.clearCache();
    this.positions.clearHistory();
  }
}

// Create a singleton instance for global use
export const gps51DirectManager = new GPS51DirectManager();

// Version and metadata
export const GPS51_DIRECT_VERSION = '1.0.0';
export const GPS51_DIRECT_BUILD = 'phase1-core';

console.log(`GPS51 Direct Integration v${GPS51_DIRECT_VERSION} (${GPS51_DIRECT_BUILD}) loaded`);