import { GPS51CredentialsManager, GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { GPS51Client } from './GPS51Client';

/**
 * Unified GPS51 Authentication Service
 * Consolidates all authentication services to eliminate conflicts
 */
export class GPS51UnifiedAuthService {
  private static instance: GPS51UnifiedAuthService;
  private credentialsManager: GPS51CredentialsManager;
  private client: GPS51Client;
  private isAuthenticated = false;
  private currentToken: string | null = null;
  private currentUser: any = null;

  constructor() {
    this.credentialsManager = new GPS51CredentialsManager();
    this.client = new GPS51Client();
  }

  static getInstance(): GPS51UnifiedAuthService {
    if (!GPS51UnifiedAuthService.instance) {
      GPS51UnifiedAuthService.instance = new GPS51UnifiedAuthService();
    }
    return GPS51UnifiedAuthService.instance;
  }

  /**
   * Primary authentication method - replaces all other authentication services
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
      
      if (!authCredentials) {
        return {
          success: false,
          error: 'No credentials available. Please configure GPS51 credentials first.'
        };
      }

      console.log('GPS51UnifiedAuthService: Using credentials:', {
        username: authCredentials.username,
        hasPassword: !!authCredentials.password,
        apiUrl: authCredentials.apiUrl,
        from: authCredentials.from,
        type: authCredentials.type
      });

      // Use intelligent connection manager for robust authentication
      const connectionResult = await gps51IntelligentConnectionManager.connectWithBestStrategy(authCredentials);

      if (connectionResult.success && connectionResult.token) {
        // Store authentication state
        this.isAuthenticated = true;
        this.currentToken = connectionResult.token;
        this.currentUser = connectionResult.user;

        // Save credentials if they were provided
        if (credentials) {
          this.credentialsManager.setCredentials(credentials);
        }

        // Store token for other services
        localStorage.setItem('gps51_auth_token', connectionResult.token);
        localStorage.setItem('gps51_connection_strategy', connectionResult.strategy);

        // Initialize GPS51Client with our token
        if (this.currentUser) {
          // Set the client's internal state
          (this.client as any).token = this.currentToken;
          (this.client as any).user = this.currentUser;
          (this.client as any).tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        }

        // Dispatch authentication success event
        window.dispatchEvent(new CustomEvent('gps51-authentication-success', {
          detail: {
            token: connectionResult.token,
            user: connectionResult.user,
            strategy: connectionResult.strategy
          }
        }));

        console.log('GPS51UnifiedAuthService: Authentication successful via', connectionResult.strategy);

        return {
          success: true,
          token: connectionResult.token,
          user: connectionResult.user,
          strategy: connectionResult.strategy,
          responseTime: connectionResult.responseTime
        };
      } else {
        this.clearAuthenticationState();
        
        return {
          success: false,
          error: connectionResult.error || 'Authentication failed',
          strategy: connectionResult.strategy,
          responseTime: connectionResult.responseTime
        };
      }
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Authentication failed:', error);
      this.clearAuthenticationState();
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  /**
   * Test connection using unified service with production-grade diagnostics
   */
  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    try {
      console.log('GPS51UnifiedAuthService: Testing production-ready connection...');
      
      // Get baseline health status
      const baseHealthStatus = gps51IntelligentConnectionManager.getConnectionHealth();
      
      // Run comprehensive connection tests
      const testResults = await gps51IntelligentConnectionManager.testAllConnections(apiUrl);
      
      const proxyResult = testResults.get('proxy');
      const directResult = testResults.get('direct');
      
      // Enhanced health analysis
      const enhancedHealthStatus = {
        ...baseHealthStatus,
        connectionTests: {
          proxy: {
            success: proxyResult?.success || false,
            responseTime: proxyResult?.responseTime || 0,
            error: proxyResult?.error
          },
          direct: {
            success: directResult?.success || false,
            responseTime: directResult?.responseTime || 0,
            error: directResult?.error
          }
        },
        overallHealth: (proxyResult?.success || directResult?.success) ? 'Good' : 'Poor',
        recommendedStrategy: proxyResult?.success ? 'proxy' : directResult?.success ? 'direct' : 'troubleshooting_needed',
        productionReadiness: (proxyResult?.success && proxyResult.responseTime < 3000) ? 'Ready' : 'Needs Optimization'
      };
      
      console.log('GPS51UnifiedAuthService: Enhanced connection test results:', enhancedHealthStatus);
      
      return {
        success: proxyResult?.success || directResult?.success || false,
        responseTime: proxyResult?.responseTime || directResult?.responseTime || 0,
        error: proxyResult?.error || directResult?.error,
        healthStatus: enhancedHealthStatus
      };
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Connection test failed:', error);
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Connection test failed',
        healthStatus: {
          overallHealth: 'Error',
          error: error instanceof Error ? error.message : 'Unknown error',
          productionReadiness: 'Not Ready'
        }
      };
    }
  }

  /**
   * Get current authentication status
   */
  getAuthenticationStatus(): {
    isAuthenticated: boolean;
    hasToken: boolean;
    user: any;
    connectionHealth: any;
  } {
    const healthStatus = gps51IntelligentConnectionManager.getConnectionHealth();
    
    return {
      isAuthenticated: this.isAuthenticated,
      hasToken: !!this.currentToken,
      user: this.currentUser,
      connectionHealth: healthStatus
    };
  }

  /**
   * Get GPS51 client instance for data operations
   */
  getClient(): GPS51Client {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }
    return this.client;
  }

  /**
   * Check if currently authenticated
   */
  isCurrentlyAuthenticated(): boolean {
    return this.isAuthenticated && !!this.currentToken;
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
   * Clear all authentication state
   */
  logout(): void {
    console.log('GPS51UnifiedAuthService: Logging out...');
    this.clearAuthenticationState();
    this.credentialsManager.clearCredentials();
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('gps51-authentication-logout'));
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
   * Clear authentication state without affecting stored credentials
   */
  private clearAuthenticationState(): void {
    this.isAuthenticated = false;
    this.currentToken = null;
    this.currentUser = null;
    
    // Clear token from localStorage
    localStorage.removeItem('gps51_auth_token');
    localStorage.removeItem('gps51_connection_strategy');
    
    // Reset client state
    this.client.logout();
  }

  /**
   * Initialize authentication on startup
   */
  async initializeAuthentication(): Promise<boolean> {
    try {
      console.log('GPS51UnifiedAuthService: Initializing authentication on startup...');
      
      // Check for existing credentials
      const credentials = await this.credentialsManager.getCredentials();
      if (!credentials) {
        console.log('GPS51UnifiedAuthService: No stored credentials found');
        return false;
      }

      // Attempt authentication
      const result = await this.authenticate(credentials);
      
      if (result.success) {
        console.log('GPS51UnifiedAuthService: Startup authentication successful');
        return true;
      } else {
        console.warn('GPS51UnifiedAuthService: Startup authentication failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Startup authentication error:', error);
      return false;
    }
  }
}

export const gps51UnifiedAuthService = GPS51UnifiedAuthService.getInstance();