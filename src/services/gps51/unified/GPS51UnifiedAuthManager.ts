/**
 * GPS51 Unified Authentication Manager
 * Single source of truth for all GPS51 authentication, credentials, and tokens
 * Eliminates the fragmented authentication state across multiple services
 */

import { GPS51TokenManager, GPS51AuthToken } from '../../../services/gp51/GPS51TokenManager';
import { GPS51Credentials } from '../../../services/gp51/GPS51CredentialsManager';
import { GPS51Utils } from '../GPS51Utils';

export interface GPS51UnifiedAuthState {
  isAuthenticated: boolean;
  token: string | null;
  tokenExpiry: Date | null;
  username: string | null;
  credentials: GPS51Credentials | null;
  error?: string;
  lastLoginTime?: Date;
}

export interface GPS51LoginResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  responseTime?: number;
}

/**
 * Unified GPS51 Authentication Manager
 * Centralizes all authentication logic, credential storage, and token management
 */
export class GPS51UnifiedAuthManager {
  private static instance: GPS51UnifiedAuthManager;
  private tokenManager: GPS51TokenManager;
  
  private authState: GPS51UnifiedAuthState = {
    isAuthenticated: false,
    token: null,
    tokenExpiry: null,
    username: null,
    credentials: null
  };

  private readonly STORAGE_KEY = 'gps51_auth_state';
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.tokenManager = new GPS51TokenManager();
    this.initializeAsync();
    this.setupTokenRefreshListener();
    
    console.log('GPS51UnifiedAuthManager: Initialized');
  }

  private async initializeAsync(): Promise<void> {
    await this.loadAuthState();
  }

  static getInstance(): GPS51UnifiedAuthManager {
    if (!GPS51UnifiedAuthManager.instance) {
      GPS51UnifiedAuthManager.instance = new GPS51UnifiedAuthManager();
    }
    return GPS51UnifiedAuthManager.instance;
  }

  /**
   * Authenticate with GPS51 API using Edge Function
   */
  async authenticate(username: string, password: string, apiUrl?: string): Promise<GPS51LoginResult> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51UnifiedAuthManager: Starting authentication for', username);
      
      // Ensure password is MD5 hashed
      const hashedPassword = await GPS51Utils.ensureMD5Hash(password);
      
      // Use default API URL if not provided
      const finalApiUrl = apiUrl || 'https://api.gps51.com/openapi';
      
      // Store credentials immediately for future use
      const credentials: GPS51Credentials = {
        username,
        password: hashedPassword,
        apiUrl: finalApiUrl,
        from: 'WEB',
        type: 'USER'
      };

      console.log('GPS51UnifiedAuthManager: Calling Edge Function for authentication');
      
      // Call Edge Function for authentication
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: response, error: edgeError } = await supabase.functions.invoke('gps51-auth', {
        body: {
          action: 'login',
          username,
          password: hashedPassword,
          from: 'WEB',
          type: 'USER',
          apiUrl: finalApiUrl
        }
      });

      if (edgeError) {
        throw new Error(`Edge Function error: ${edgeError.message}`);
      }

      if (!response || !response.success) {
        throw new Error(response?.error || 'Authentication failed');
      }

      // Extract token from response (handle both access_token and token fields)
      const token = response.access_token || response.token;
      if (!token) {
        throw new Error('Authentication successful but no token received');
      }

      // Update token manager
      this.tokenManager.setToken({
        access_token: token,
        expires_in: response.expires_in || (24 * 60 * 60) // Default 24 hours
      });

      // Update auth state
      this.authState = {
        isAuthenticated: true,
        token,
        tokenExpiry: new Date(Date.now() + (response.expires_in || 86400) * 1000),
        username,
        credentials,
        lastLoginTime: new Date()
      };

      // Persist auth state
      this.saveAuthState();
      
      // Setup token auto-refresh
      this.setupTokenAutoRefresh();

      const responseTime = Date.now() - startTime;
      console.log('GPS51UnifiedAuthManager: Authentication successful', {
        username,
        tokenLength: token.length,
        responseTime,
        hasUser: !!response.user
      });

      return {
        success: true,
        token,
        user: response.user,
        responseTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      this.authState = {
        isAuthenticated: false,
        token: null,
        tokenExpiry: null,
        username: null,
        credentials: null,
        error: errorMessage
      };

      console.error('GPS51UnifiedAuthManager: Authentication failed:', error);
      
      return {
        success: false,
        error: errorMessage,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get valid token for API calls
   */
  async getValidToken(): Promise<string | null> {
    // Check if we have a valid token
    const token = await this.tokenManager.getValidToken();
    if (token) {
      return token;
    }

    // Token expired or not available, try to re-authenticate if we have credentials
    if (this.authState.credentials) {
      console.log('GPS51UnifiedAuthManager: Token expired, attempting re-authentication');
      
      const result = await this.authenticate(
        this.authState.credentials.username,
        this.authState.credentials.password,
        this.authState.credentials.apiUrl
      );

      if (result.success && result.token) {
        return result.token;
      }
    }

    console.warn('GPS51UnifiedAuthManager: No valid token available and cannot re-authenticate');
    return null;
  }

  /**
   * Check if currently authenticated with valid token
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && this.tokenManager.isTokenValid();
  }

  /**
   * Get current authentication state
   */
  getAuthState(): GPS51UnifiedAuthState {
    // Update authentication status based on token validity
    const isTokenValid = this.tokenManager.isTokenValid();
    
    return {
      ...this.authState,
      isAuthenticated: this.authState.isAuthenticated && isTokenValid
    };
  }

  /**
   * Logout and clear all authentication data
   */
  logout(): void {
    console.log('GPS51UnifiedAuthManager: Logging out');
    
    // Clear token manager
    this.tokenManager.clearToken();
    
    // Clear auth state
    this.authState = {
      isAuthenticated: false,
      token: null,
      tokenExpiry: null,
      username: null,
      credentials: null
    };

    // Clear stored state
    this.clearStoredAuthState();
    
    // Clear auto-refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Get stored credentials for auto-authentication
   */
  getStoredCredentials(): GPS51Credentials | null {
    return this.authState.credentials;
  }

  /**
   * Check if we have stored credentials for auto-authentication
   */
  hasStoredCredentials(): boolean {
    return !!(this.authState.credentials?.username && 
             this.authState.credentials?.password && 
             this.authState.credentials?.apiUrl);
  }

  /**
   * Setup token auto-refresh based on expiry
   */
  private setupTokenAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.authState.tokenExpiry) return;

    const now = Date.now();
    const expiryTime = this.authState.tokenExpiry.getTime();
    const refreshTime = expiryTime - (5 * 60 * 1000); // Refresh 5 minutes before expiry

    if (refreshTime > now) {
      const timeUntilRefresh = refreshTime - now;
      console.log(`GPS51UnifiedAuthManager: Token auto-refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`);
      
      this.refreshTimer = setTimeout(async () => {
        console.log('GPS51UnifiedAuthManager: Auto-refreshing token');
        await this.refreshToken();
      }, timeUntilRefresh);
    }
  }

  /**
   * Refresh token using stored credentials
   */
  private async refreshToken(): Promise<void> {
    if (!this.authState.credentials) {
      console.warn('GPS51UnifiedAuthManager: Cannot refresh token - no stored credentials');
      return;
    }

    try {
      await this.authenticate(
        this.authState.credentials.username,
        this.authState.credentials.password,
        this.authState.credentials.apiUrl
      );
    } catch (error) {
      console.error('GPS51UnifiedAuthManager: Token refresh failed:', error);
    }
  }

  /**
   * Setup listener for token refresh events
   */
  private setupTokenRefreshListener(): void {
    window.addEventListener('gps51-token-refresh-needed', () => {
      console.log('GPS51UnifiedAuthManager: Token refresh event received');
      this.refreshToken();
    });
  }

  /**
   * Save authentication state to localStorage
   */
  private saveAuthState(): void {
    try {
      const stateToSave = {
        username: this.authState.username,
        credentials: this.authState.credentials,
        lastLoginTime: this.authState.lastLoginTime?.toISOString(),
        tokenExpiry: this.authState.tokenExpiry?.toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
      console.log('GPS51UnifiedAuthManager: Auth state saved to localStorage');
    } catch (error) {
      console.error('GPS51UnifiedAuthManager: Failed to save auth state:', error);
    }
  }

  /**
   * Load authentication state from localStorage
   */
  private async loadAuthState(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const parsedState = JSON.parse(stored);
      
      // Restore basic state
      this.authState.username = parsedState.username;
      this.authState.credentials = parsedState.credentials;
      this.authState.lastLoginTime = parsedState.lastLoginTime ? new Date(parsedState.lastLoginTime) : undefined;
      this.authState.tokenExpiry = parsedState.tokenExpiry ? new Date(parsedState.tokenExpiry) : null;
      
      // Check if we have a valid token from token manager
      const validToken = await this.tokenManager.getValidToken();
      if (validToken) {
        this.authState.isAuthenticated = true;
        this.authState.token = validToken;
        this.setupTokenAutoRefresh();
        
        console.log('GPS51UnifiedAuthManager: Auth state restored from localStorage with valid token');
      } else {
        console.log('GPS51UnifiedAuthManager: Auth state restored but token is invalid/expired');
      }

    } catch (error) {
      console.error('GPS51UnifiedAuthManager: Failed to load auth state:', error);
      this.clearStoredAuthState();
    }
  }

  /**
   * Clear stored authentication state
   */
  private clearStoredAuthState(): void {
    // Clear unified storage
    localStorage.removeItem(this.STORAGE_KEY);
    
    // Clear legacy storage keys for compatibility
    const legacyKeys = [
      'gps51_credentials',
      'gps51_username',
      'gps51_password_hash',
      'gps51_api_url',
      'gps51_from',
      'gps51_type',
      'gps51_api_key',
      'gps51_token'
    ];
    
    legacyKeys.forEach(key => localStorage.removeItem(key));
    
    console.log('GPS51UnifiedAuthManager: All stored auth data cleared');
  }
}

// Export singleton instance
export const gps51UnifiedAuthManager = GPS51UnifiedAuthManager.getInstance();