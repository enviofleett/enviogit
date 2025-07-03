import { GPS51AuthCredentials, GPS51User } from '../GPS51Types';
import { GPS51Utils } from '../GPS51Utils';
import { GPS51EnhancedApiClient } from './GPS51EnhancedApiClient';
import { GPS51_STATUS } from '../GPS51Constants';

export interface GPS51AuthResult {
  success: boolean;
  user?: GPS51User;
  token?: string;
  error?: string;
  retryAfter?: number;
}

export interface GPS51AuthState {
  isAuthenticated: boolean;
  user: GPS51User | null;
  token: string | null;
  tokenExpiry: number | null;
  lastAuthAttempt: number;
  authErrors: number;
}

export class GPS51DirectAuthService {
  private apiClient: GPS51EnhancedApiClient;
  private state: GPS51AuthState;
  private maxRetries = 3;
  private backoffMultiplier = 2;
  private maxBackoffDelay = 30000; // 30 seconds

  constructor(baseURL?: string) {
    this.apiClient = new GPS51EnhancedApiClient(baseURL);
    this.state = this.getInitialState();
  }

  private getInitialState(): GPS51AuthState {
    return {
      isAuthenticated: false,
      user: null,
      token: null,
      tokenExpiry: null,
      lastAuthAttempt: 0,
      authErrors: 0
    };
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<GPS51AuthResult> {
    const now = Date.now();
    
    // Check if we need to wait due to rate limiting
    if (this.shouldWaitForRateLimit(now)) {
      const waitTime = this.calculateWaitTime(now);
      return {
        success: false,
        error: 'Rate limited. Please wait before retrying.',
        retryAfter: waitTime
      };
    }

    this.state.lastAuthAttempt = now;

    try {
      console.log('GPS51DirectAuthService: Starting authentication process...');
      
      // Validate credentials before sending
      const validationResult = this.validateCredentials(credentials);
      if (!validationResult.valid) {
        this.state.authErrors++;
        return {
          success: false,
          error: validationResult.error
        };
      }

      // Set API base URL if provided
      if (credentials.apiUrl) {
        const normalizedUrl = GPS51Utils.normalizeApiUrl(credentials.apiUrl);
        this.apiClient.setBaseURL(normalizedUrl);
      }

      // Prepare authentication parameters
      const authParams = {
        username: credentials.username,
        password: credentials.password,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      };

      // Attempt authentication with retry logic
      const response = await this.apiClient.makeAuthenticatedRequest(
        'login',
        authParams,
        'POST'
      );

      return this.handleAuthResponse(response, credentials);

    } catch (error) {
      this.state.authErrors++;
      console.error('GPS51DirectAuthService: Authentication failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private validateCredentials(credentials: GPS51AuthCredentials): { valid: boolean; error?: string } {
    if (!credentials.username || credentials.username.trim().length === 0) {
      return { valid: false, error: 'Username is required' };
    }

    if (!credentials.password || credentials.password.trim().length === 0) {
      return { valid: false, error: 'Password is required' };
    }

    if (!GPS51Utils.validateMD5Hash(credentials.password)) {
      return { valid: false, error: 'Password must be MD5 hashed (32 character lowercase hex)' };
    }

    if (!credentials.apiUrl || !this.isValidUrl(credentials.apiUrl)) {
      return { valid: false, error: 'Valid API URL is required' };
    }

    return { valid: true };
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private handleAuthResponse(response: any, credentials: GPS51AuthCredentials): GPS51AuthResult {
    console.log('GPS51DirectAuthService: Processing auth response:', {
      status: response.status,
      hasToken: !!response.token,
      hasUser: !!response.user
    });

    if (response.status === GPS51_STATUS.SUCCESS && response.token) {
      // Authentication successful
      const tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      
      this.state = {
        isAuthenticated: true,
        user: response.user || null,
        token: response.token,
        tokenExpiry,
        lastAuthAttempt: Date.now(),
        authErrors: 0
      };

      console.log('GPS51DirectAuthService: Authentication successful');
      
      return {
        success: true,
        user: response.user,
        token: response.token
      };
    } else {
      // Authentication failed
      this.state.authErrors++;
      
      let errorMessage = response.message || response.cause || 'Authentication failed';
      
      // Add specific error context
      if (response.status === 8901) {
        errorMessage += ' (Invalid credentials or parameters)';
      } else if (response.status === 1) {
        errorMessage += ' (Login failed - verify account status)';
      }

      console.error('GPS51DirectAuthService: Authentication failed:', {
        status: response.status,
        message: response.message,
        cause: response.cause
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async refreshToken(): Promise<GPS51AuthResult> {
    if (!this.state.token || !this.state.user) {
      return {
        success: false,
        error: 'No active session to refresh'
      };
    }

    try {
      console.log('GPS51DirectAuthService: Refreshing token...');
      
      // Test token validity with a simple API call
      const response = await this.apiClient.makeAuthenticatedRequest(
        'querymonitorlist',
        { username: this.state.user.username },
        'POST',
        this.state.token
      );

      if (response.status === GPS51_STATUS.SUCCESS) {
        // Token is still valid, update expiry
        this.state.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
        
        console.log('GPS51DirectAuthService: Token refresh successful');
        return {
          success: true,
          user: this.state.user,
          token: this.state.token
        };
      } else {
        // Token is invalid, clear state
        this.logout();
        return {
          success: false,
          error: 'Token expired or invalid'
        };
      }
    } catch (error) {
      console.error('GPS51DirectAuthService: Token refresh failed:', error);
      this.logout();
      return {
        success: false,
        error: 'Token refresh failed'
      };
    }
  }

  private shouldWaitForRateLimit(now: number): boolean {
    const timeSinceLastAttempt = now - this.state.lastAuthAttempt;
    const requiredWaitTime = this.calculateBackoffDelay();
    
    return this.state.authErrors >= this.maxRetries && timeSinceLastAttempt < requiredWaitTime;
  }

  private calculateWaitTime(now: number): number {
    const timeSinceLastAttempt = now - this.state.lastAuthAttempt;
    const requiredWaitTime = this.calculateBackoffDelay();
    
    return Math.max(0, requiredWaitTime - timeSinceLastAttempt);
  }

  private calculateBackoffDelay(): number {
    const baseDelay = 1000; // 1 second
    const exponentialDelay = baseDelay * Math.pow(this.backoffMultiplier, this.state.authErrors - 1);
    return Math.min(exponentialDelay, this.maxBackoffDelay);
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated && 
           this.state.token !== null && 
           (this.state.tokenExpiry === null || Date.now() < this.state.tokenExpiry);
  }

  getAuthState(): GPS51AuthState {
    return { ...this.state };
  }

  getToken(): string | null {
    return this.isAuthenticated() ? this.state.token : null;
  }

  getUser(): GPS51User | null {
    return this.isAuthenticated() ? this.state.user : null;
  }

  logout(): void {
    console.log('GPS51DirectAuthService: Logging out');
    this.state = this.getInitialState();
  }

  // Health check methods
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: 'Not authenticated' };
    }

    const startTime = Date.now();
    
    try {
      const response = await this.apiClient.makeAuthenticatedRequest(
        'querymonitorlist',
        { username: this.state.user?.username || 'test' },
        'POST',
        this.state.token!
      );

      const latency = Date.now() - startTime;

      return {
        success: response.status === GPS51_STATUS.SUCCESS,
        latency,
        error: response.status !== GPS51_STATUS.SUCCESS ? response.message : undefined
      };
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}