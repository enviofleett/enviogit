/**
 * GPS51 Authentication Manager
 * Handles authentication state and token management
 */

import { EmergencyGPS51Client } from '../emergency/EmergencyGPS51Client';
import { gps51SimpleAuthSync } from '../GPS51SimpleAuthSync';

export interface GPS51AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  error?: string;
}

export class GPS51AuthManager {
  private authState: GPS51AuthState = {
    isAuthenticated: false,
    token: null,
    username: null
  };

  private client: EmergencyGPS51Client;

  constructor(apiUrl: string) {
    this.client = new EmergencyGPS51Client(apiUrl);
  }

  /**
   * Authenticate user and store token
   */
  async authenticate(username: string, password: string): Promise<GPS51AuthState> {
    try {
      console.log('GPS51AuthManager: Starting authentication for', username);
      
      // Call login API - password should already be MD5 hashed
      const token = await this.client.login(username, password);
      
      this.authState = {
        isAuthenticated: true,
        token,
        username
      };

      // Store username in localStorage for GPS51Client access
      localStorage.setItem('gps51_username', username);
      console.log('GPS51AuthManager: Username stored in localStorage for GPS51Client access');

      // Use simple auth sync to prevent circular loops
      gps51SimpleAuthSync.notifyAuthSuccess(username);

      console.log('GPS51AuthManager: Authentication successful');
      return this.authState;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.authState = {
        isAuthenticated: false,
        token: null,
        username: null,
        error: errorMessage
      };

      console.error('GPS51AuthManager: Authentication failed:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    try {
      await this.client.logout();
    } catch (error) {
      console.warn('GPS51AuthManager: Logout error:', error);
    }

    this.authState = {
      isAuthenticated: false,
      token: null,
      username: null
    };
    
    // Clear username from localStorage
    localStorage.removeItem('gps51_username');
    
    // Notify simple auth sync of logout
    gps51SimpleAuthSync.notifyLogout();
    
    console.log('GPS51AuthManager: Logged out and reset');
  }

  /**
   * Get current authentication state
   */
  getAuthState(): GPS51AuthState {
    return { ...this.authState };
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current username
   */
  getUsername(): string | null {
    return this.authState.username;
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.authState.token;
  }
}