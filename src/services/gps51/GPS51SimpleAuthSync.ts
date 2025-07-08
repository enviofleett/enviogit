/**
 * SIMPLIFIED GPS51 Authentication State Synchronization
 * Eliminates circular loops and conflicts between multiple auth services
 */

interface SimpleAuthState {
  isAuthenticated: boolean;
  username: string | null;
  timestamp: number;
}

export class GPS51SimpleAuthSync {
  private static instance: GPS51SimpleAuthSync;
  private currentState: SimpleAuthState = {
    isAuthenticated: false,
    username: null,
    timestamp: 0
  };

  private constructor() {
    this.initializeFromStorage();
  }

  static getInstance(): GPS51SimpleAuthSync {
    if (!GPS51SimpleAuthSync.instance) {
      GPS51SimpleAuthSync.instance = new GPS51SimpleAuthSync();
    }
    return GPS51SimpleAuthSync.instance;
  }

  /**
   * CRITICAL FIX: Simple authentication success notification
   * No circular dependencies or token duplication
   */
  notifyAuthSuccess(username: string): void {
    console.log('GPS51SimpleAuthSync: Authentication success for', username);
    
    this.currentState = {
      isAuthenticated: true,
      username,
      timestamp: Date.now()
    };

    this.saveToStorage();
    
    // Simple event dispatch without complex data
    window.dispatchEvent(new CustomEvent('gps51-auth-status-changed', {
      detail: { isAuthenticated: true, username }
    }));
  }

  /**
   * CRITICAL FIX: Simple logout notification
   */
  notifyLogout(): void {
    console.log('GPS51SimpleAuthSync: Logout notification');
    
    this.currentState = {
      isAuthenticated: false,
      username: null,
      timestamp: Date.now()
    };

    this.clearStorage();
    
    window.dispatchEvent(new CustomEvent('gps51-auth-status-changed', {
      detail: { isAuthenticated: false, username: null }
    }));
  }

  /**
   * Get current auth status (no sensitive data)
   */
  getAuthStatus(): SimpleAuthState {
    return { ...this.currentState };
  }

  /**
   * Check if authentication appears valid
   */
  isAuthenticated(): boolean {
    if (!this.currentState.isAuthenticated) {
      return false;
    }

    // Check if state is fresh (less than 24 hours old)
    const maxAge = 24 * 60 * 60 * 1000;
    return (Date.now() - this.currentState.timestamp) < maxAge;
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('gps51_simple_auth_state', JSON.stringify(this.currentState));
    } catch (error) {
      console.warn('GPS51SimpleAuthSync: Failed to save auth state:', error);
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('gps51_simple_auth_state');
  }

  private initializeFromStorage(): void {
    try {
      const stored = localStorage.getItem('gps51_simple_auth_state');
      if (stored) {
        const state = JSON.parse(stored);
        if (this.isStateFresh(state.timestamp)) {
          this.currentState = state;
          console.log('GPS51SimpleAuthSync: Restored auth state for', state.username);
        } else {
          this.clearStorage();
          console.log('GPS51SimpleAuthSync: Cleared expired auth state');
        }
      }
    } catch (error) {
      console.warn('GPS51SimpleAuthSync: Failed to restore auth state:', error);
      this.clearStorage();
    }
  }

  private isStateFresh(timestamp: number): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return (Date.now() - timestamp) < maxAge;
  }
}

export const gps51SimpleAuthSync = GPS51SimpleAuthSync.getInstance();