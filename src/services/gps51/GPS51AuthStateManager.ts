import { GPS51Client } from './GPS51Client';

/**
 * Manages GPS51 authentication state and synchronization
 */
export class GPS51AuthStateManager {
  private isAuthenticated = false;
  private currentToken: string | null = null;
  private currentUser: any = null;
  private client: GPS51Client;

  constructor(client: GPS51Client) {
    this.client = client;
  }

  /**
   * Set authentication state
   */
  setAuthenticationState(token: string, user: any): void {
    this.isAuthenticated = true;
    this.currentToken = token;
    this.currentUser = user;

    // Store token for other services
    localStorage.setItem('gps51_auth_token', token);

    // Update shared client state
    this.client.setAuthenticationState(
      token,
      user || null,
      Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    );

    console.log('GPS51AuthStateManager: Authentication state set:', {
      hasToken: !!token,
      hasUser: !!user,
      clientAuthenticated: this.client.isAuthenticated()
    });

    // CRITICAL FIX: Dispatch connection health update after authentication
    this.dispatchConnectionHealthUpdate();
  }

  /**
   * Clear authentication state
   */
  clearAuthenticationState(): void {
    this.isAuthenticated = false;
    this.currentToken = null;
    this.currentUser = null;

    // Clear token from localStorage
    localStorage.removeItem('gps51_auth_token');
    localStorage.removeItem('gps51_connection_strategy');

    // Clear shared client state
    this.client.clearAuthenticationState();

    console.log('GPS51AuthStateManager: Authentication state cleared');
  }

  /**
   * Check if currently authenticated
   */
  isCurrentlyAuthenticated(): boolean {
    const internalAuth = this.isAuthenticated && !!this.currentToken;
    const clientAuth = this.client.isAuthenticated();
    return internalAuth && clientAuth;
  }

  /**
   * Get authentication status with diagnostics
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean;
    hasToken: boolean;
    user: any;
    diagnostics: {
      internalAuth: boolean;
      clientAuth: boolean;
      tokenFromStorage: boolean;
      sessionConsistency: boolean;
    };
  } {
    const internalAuth = this.isAuthenticated && !!this.currentToken;
    const clientAuth = this.client.isAuthenticated();
    const tokenFromStorage = !!localStorage.getItem('gps51_auth_token');

    return {
      isAuthenticated: this.isAuthenticated,
      hasToken: !!this.currentToken,
      user: this.currentUser,
      diagnostics: {
        internalAuth,
        clientAuth,
        tokenFromStorage,
        sessionConsistency: internalAuth === clientAuth
      }
    };
  }

  /**
   * Get current token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.currentUser;
  }

  /**
   * Get GPS51 client instance
   */
  getClient(): GPS51Client {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }
    return this.client;
  }

  /**
   * Dispatch authentication success event
   */
  dispatchAuthenticationEvent(token: string, user: any, strategy: string): void {
    window.dispatchEvent(new CustomEvent('gps51-authentication-success', {
      detail: { token, user, strategy }
    }));
  }

  /**
   * Dispatch logout event
   */
  dispatchLogoutEvent(): void {
    window.dispatchEvent(new CustomEvent('gps51-authentication-logout'));
  }

  /**
   * Dispatch connection health update event
   */
  dispatchConnectionHealthUpdate(): void {
    window.dispatchEvent(new CustomEvent('gps51-connection-health-update', {
      detail: {
        isAuthenticated: this.isAuthenticated,
        hasToken: !!this.currentToken,
        timestamp: Date.now()
      }
    }));
  }
}