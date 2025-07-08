import { GPS51CredentialsManager, GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { GPS51Client, gps51Client } from './GPS51Client';
import { GPS51AuthStateManager } from './GPS51AuthStateManager';
import { GPS51SessionManager } from './GPS51SessionManager';
import { GPS51ConnectionTester } from './GPS51ConnectionTester';
import { GPS51AuthenticationCore } from './GPS51AuthenticationCore';
import { gps51AuthStateSync } from './GPS51AuthStateSync';

/**
 * Unified GPS51 Authentication Service
 * Consolidates all authentication services to eliminate conflicts
 * Now refactored into focused, modular components
 */
export class GPS51UnifiedAuthService {
  private static instance: GPS51UnifiedAuthService;
  private credentialsManager: GPS51CredentialsManager;
  private authStateManager: GPS51AuthStateManager;
  private sessionManager: GPS51SessionManager;
  private connectionTester: GPS51ConnectionTester;
  private authenticationCore: GPS51AuthenticationCore;

  constructor() {
    this.credentialsManager = new GPS51CredentialsManager();
    this.authStateManager = new GPS51AuthStateManager(gps51Client);
    this.sessionManager = new GPS51SessionManager(this.authStateManager, this.credentialsManager);
    this.connectionTester = new GPS51ConnectionTester();
    this.authenticationCore = new GPS51AuthenticationCore();
  }

  static getInstance(): GPS51UnifiedAuthService {
    if (!GPS51UnifiedAuthService.instance) {
      GPS51UnifiedAuthService.instance = new GPS51UnifiedAuthService();
    }
    return GPS51UnifiedAuthService.instance;
  }

  /**
   * Primary authentication method - now using modular components
   */
  async authenticate(credentials?: GPS51Credentials): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    user?: any;
    strategy?: string;
    responseTime?: number;
  }> {
    try {
      console.log('GPS51UnifiedAuthService: Starting unified authentication...');

      // Use provided credentials or load from storage
      const authCredentials = credentials || await this.credentialsManager.getCredentials();
      
      // Validate credentials
      const validation = this.authenticationCore.validateCredentials(authCredentials);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Invalid credentials'
        };
      }

      // Perform authentication using core module
      const result = await this.authenticationCore.authenticate(authCredentials);

      if (result.success && result.token) {
        // Save credentials if they were provided
        if (credentials) {
          this.credentialsManager.setCredentials(credentials);
        }

        // Store connection strategy
        localStorage.setItem('gps51_connection_strategy', result.strategy || 'unknown');

        // Set authentication state using state manager
        this.authStateManager.setAuthenticationState(result.token, result.user);

        // CRITICAL FIX: Synchronize authentication state across all services
        gps51AuthStateSync.synchronizeAuthState(
          result.token, 
          result.user, 
          authCredentials.username, 
          'unified'
        );

        // Dispatch authentication success event
        this.authStateManager.dispatchAuthenticationEvent(result.token, result.user, result.strategy || 'unknown');

        console.log('GPS51UnifiedAuthService: Authentication successful via', result.strategy);
        return result;
      } else {
        this.authStateManager.clearAuthenticationState();
        return result;
      }
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Authentication failed:', error);
      this.authStateManager.clearAuthenticationState();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  /**
   * Test connection using connection tester module
   */
  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    // CRITICAL FIX: Pass current authentication state to connection tester
    const authStatus = this.getAuthenticationStatus();
    const authenticationState = {
      isAuthenticated: authStatus.isAuthenticated,
      hasToken: authStatus.hasToken
    };
    
    return await this.connectionTester.testConnection(apiUrl, authenticationState);
  }

  /**
   * Get current authentication status with enhanced diagnostics
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean;
    hasToken: boolean;
    user: any;
    connectionHealth: any;
    diagnostics: {
      internalAuth: boolean;
      clientAuth: boolean;
      tokenFromStorage: boolean;
      credentialsAvailable: boolean;
      sessionConsistency: boolean;
    };
  } {
    const status = this.authStateManager.getAuthenticationStatus();
    const healthStatus = this.connectionTester.getConnectionHealth();
    
    return {
      ...status,
      connectionHealth: healthStatus,
      diagnostics: {
        ...status.diagnostics,
        credentialsAvailable: !!this.credentialsManager
      }
    };
  }

  /**
   * Get GPS51 client instance for data operations
   */
  getClient(): GPS51Client {
    return this.authStateManager.getClient();
  }

  /**
   * Check if currently authenticated with enhanced validation
   */
  isCurrentlyAuthenticated(): boolean {
    const isAuthenticated = this.authStateManager.isCurrentlyAuthenticated();
    
    // Check if session restoration is needed
    if (!isAuthenticated) {
      this.sessionManager.triggerBackgroundRestoration();
    }
    
    return isAuthenticated;
  }

  /**
   * Get current token
   */
  getCurrentToken(): string | null {
    return this.authStateManager.getCurrentToken();
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.authStateManager.getCurrentUser();
  }

  /**
   * Clear all authentication state
   */
  logout(): void {
    console.log('GPS51UnifiedAuthService: Logging out...');
    this.authStateManager.clearAuthenticationState();
    this.credentialsManager.clearCredentials();
    
    // CRITICAL FIX: Clear synchronized authentication state
    gps51AuthStateSync.clearAuthState();
    
    // Dispatch logout event
    this.authStateManager.dispatchLogoutEvent();
  }

  /**
   * Refresh authentication using stored credentials
   */
  async refreshAuthentication(): Promise<boolean> {
    try {
      console.log('GPS51UnifiedAuthService: Refreshing authentication...');
      
      const result = await this.authenticate();
      return result.success;
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Authentication refresh failed:', error);
      return false;
    }
  }

  /**
   * Initialize authentication on startup using session manager
   */
  async initializeAuthentication(): Promise<boolean> {
    return await this.sessionManager.initializeAuthentication();
  }
}

export const gps51UnifiedAuthService = GPS51UnifiedAuthService.getInstance();