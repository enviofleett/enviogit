/**
 * GPS51 Authentication State Synchronization Service
 * Ensures consistent authentication state across all GPS51 services
 */

import { GPS51Client } from './GPS51Client';
import { GPS51EmergencyManager } from './GPS51EmergencyManager';

interface AuthenticationState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  user: any;
  source: 'unified' | 'emergency' | 'direct';
  timestamp: number;
}

export class GPS51AuthStateSync {
  private static instance: GPS51AuthStateSync;
  private currentState: AuthenticationState = {
    isAuthenticated: false,
    token: null,
    username: null,
    user: null,
    source: 'unified',
    timestamp: 0
  };

  private constructor() {
    this.setupEventListeners();
    this.initializeFromExistingState();
  }

  static getInstance(): GPS51AuthStateSync {
    if (!GPS51AuthStateSync.instance) {
      GPS51AuthStateSync.instance = new GPS51AuthStateSync();
    }
    return GPS51AuthStateSync.instance;
  }

  /**
   * Synchronize authentication state across all services
   */
  synchronizeAuthState(
    token: string,
    user: any,
    username: string,
    source: 'unified' | 'emergency' | 'direct' = 'unified'
  ): void {
    console.log('GPS51AuthStateSync: Synchronizing authentication state', {
      source,
      username,
      hasToken: !!token,
      hasUser: !!user
    });

    this.currentState = {
      isAuthenticated: true,
      token,
      username,
      user,
      source,
      timestamp: Date.now()
    };

    // Dispatch authentication success event for all services
    this.dispatchAuthEvent('gps51-auth-state-sync', {
      ...this.currentState
    });

    // Store state for persistence
    this.saveAuthState();
  }

  /**
   * Clear authentication state across all services
   */
  clearAuthState(): void {
    console.log('GPS51AuthStateSync: Clearing authentication state');

    this.currentState = {
      isAuthenticated: false,
      token: null,
      username: null,
      user: null,
      source: 'unified',
      timestamp: Date.now()
    };

    // Dispatch logout event for all services
    this.dispatchAuthEvent('gps51-auth-logout', {
      timestamp: Date.now()
    });

    // Clear stored state
    localStorage.removeItem('gps51_auth_state_sync');
  }

  /**
   * Get current authentication state
   */
  getCurrentState(): AuthenticationState {
    return { ...this.currentState };
  }

  /**
   * Check if authentication is valid and consistent
   */
  isAuthenticationValid(): boolean {
    if (!this.currentState.isAuthenticated || !this.currentState.token) {
      return false;
    }

    // Check if state is too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    return (Date.now() - this.currentState.timestamp) < maxAge;
  }

  private setupEventListeners(): void {
    // Listen for authentication events from different services
    window.addEventListener('gps51-authentication-success', this.handleUnifiedAuthSuccess.bind(this));
    window.addEventListener('gps51-emergency-auth-success', this.handleEmergencyAuthSuccess.bind(this));
    window.addEventListener('gps51-authentication-logout', this.handleAuthLogout.bind(this));
  }

  private handleUnifiedAuthSuccess(event: CustomEvent): void {
    const { token, user, username } = event.detail;
    console.log('GPS51AuthStateSync: Received unified auth success');
    
    this.synchronizeAuthState(token, user, username, 'unified');
  }

  private handleEmergencyAuthSuccess(event: CustomEvent): void {
    const { username, timestamp } = event.detail;
    console.log('GPS51AuthStateSync: Received emergency auth success');
    
    // Get token from emergency manager if available
    const emergencyManager = GPS51EmergencyManager.getInstance();
    if (emergencyManager.isAuthenticated()) {
      this.synchronizeAuthState('emergency_token', null, username, 'emergency');
    }
  }

  private handleAuthLogout(): void {
    console.log('GPS51AuthStateSync: Received logout event');
    this.clearAuthState();
  }

  private dispatchAuthEvent(eventName: string, detail: any): void {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  private saveAuthState(): void {
    try {
      // Only save essential state (no sensitive tokens)
      const safeState = {
        isAuthenticated: this.currentState.isAuthenticated,
        username: this.currentState.username,
        source: this.currentState.source,
        timestamp: this.currentState.timestamp
      };
      localStorage.setItem('gps51_auth_state_sync', JSON.stringify(safeState));
    } catch (error) {
      console.warn('GPS51AuthStateSync: Failed to save auth state:', error);
    }
  }

  private initializeFromExistingState(): void {
    try {
      const saved = localStorage.getItem('gps51_auth_state_sync');
      if (saved) {
        const safeState = JSON.parse(saved);
        if (this.isStateFresh(safeState.timestamp)) {
          console.log('GPS51AuthStateSync: Restoring authentication state');
          // Restore partial state (tokens need to be re-established)
          this.currentState.username = safeState.username;
          this.currentState.source = safeState.source;
          this.currentState.timestamp = safeState.timestamp;
        }
      }
    } catch (error) {
      console.warn('GPS51AuthStateSync: Failed to restore auth state:', error);
    }
  }

  private isStateFresh(timestamp: number): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - timestamp) < maxAge;
  }
}

export const gps51AuthStateSync = GPS51AuthStateSync.getInstance();