import { GPS51CredentialsManager, GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';
import { GPS51Client, gps51Client } from './GPS51Client';

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
    this.client = gps51Client; // Use shared instance
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

        // CRITICAL FIX: Use proper authentication state setter
        console.log('GPS51UnifiedAuthService: Setting authentication state in shared client');
        this.client.setAuthenticationState(
          connectionResult.token,
          connectionResult.user || null,
          Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        );
        
        console.log('GPS51UnifiedAuthService: Shared client authentication status:', {
          isAuthenticated: this.client.isAuthenticated(),
          hasToken: !!this.client.getToken(),
          hasUser: !!this.client.getUser()
        });

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
    const healthStatus = gps51IntelligentConnectionManager.getConnectionHealth();
    const internalAuth = this.isAuthenticated && !!this.currentToken;
    const clientAuth = this.client.isAuthenticated();
    const tokenFromStorage = !!localStorage.getItem('gps51_auth_token');
    
    return {
      isAuthenticated: this.isAuthenticated,
      hasToken: !!this.currentToken,
      user: this.currentUser,
      connectionHealth: healthStatus,
      diagnostics: {
        internalAuth,
        clientAuth,
        tokenFromStorage,
        credentialsAvailable: !!this.credentialsManager,
        sessionConsistency: internalAuth === clientAuth
      }
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
   * Check if currently authenticated with enhanced validation
   */
  isCurrentlyAuthenticated(): boolean {
    // Check both internal state and shared client state
    const internalAuth = this.isAuthenticated && !!this.currentToken;
    const clientAuth = this.client.isAuthenticated();
    const tokenFromStorage = !!localStorage.getItem('gps51_auth_token');
    
    console.log('GPS51UnifiedAuthService: Enhanced authentication status check:', {
      internalAuth,
      clientAuth,
      hasToken: !!this.currentToken,
      tokenFromStorage,
      tokenMatch: this.currentToken === localStorage.getItem('gps51_auth_token'),
      overall: internalAuth && clientAuth,
      recommendation: !internalAuth && tokenFromStorage ? 'Session restore needed' : 'OK'
    });
    
    // If we have a token in storage but not in memory, trigger restoration
    if (!internalAuth && tokenFromStorage) {
      console.log('GPS51UnifiedAuthService: Detected session restoration needed');
      // Trigger async restoration (don't await to avoid blocking)
      this.initializeAuthentication().catch(error => {
        console.error('GPS51UnifiedAuthService: Background session restoration failed:', error);
      });
    }
    
    return internalAuth && clientAuth;
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
    
    // Clear shared client state
    this.client.clearAuthenticationState();
    
    console.log('GPS51UnifiedAuthService: Authentication state cleared');
  }

  /**
   * Initialize authentication on startup with enhanced persistence
   */
  async initializeAuthentication(): Promise<boolean> {
    try {
      console.log('GPS51UnifiedAuthService: Initializing enhanced authentication on startup...');
      
      // Check for stored token first
      const storedToken = localStorage.getItem('gps51_auth_token');
      if (storedToken) {
        console.log('GPS51UnifiedAuthService: Found stored token, attempting to restore session...');
        
        // Get credentials and try to restore session
        const credentials = await this.credentialsManager.getCredentials();
        if (credentials) {
          // Set token in client first
          this.client.setAuthenticationState(storedToken, null);
          
          // Test if the token is still valid by making a simple request
          try {
            const deviceList = await this.client.getDeviceList();
            
            if (deviceList && deviceList.length >= 0) {
              // Token is valid, restore full auth state
              this.isAuthenticated = true;
              this.currentToken = storedToken;
              this.currentUser = this.client.getUser(); // Get user from client
              
              console.log('GPS51UnifiedAuthService: Session restored successfully from stored token');
              
              // Dispatch authentication success event
              window.dispatchEvent(new CustomEvent('gps51-authentication-success', {
                detail: {
                  token: storedToken,
                  user: this.currentUser,
                  strategy: 'session_restore'
                }
              }));
              
              return true;
            }
          } catch (error) {
            console.log('GPS51UnifiedAuthService: Stored token validation failed, attempting fresh authentication:', error);
            this.clearAuthenticationState();
          }
        }
      }
      
      // No valid stored token, attempt fresh authentication
      const credentials = await this.credentialsManager.getCredentials();
      if (!credentials) {
        console.log('GPS51UnifiedAuthService: No stored credentials found');
        return false;
      }

      // Attempt fresh authentication with enhanced error handling
      console.log('GPS51UnifiedAuthService: Attempting fresh authentication with enhanced validation...');
      const result = await this.authenticate(credentials);
      
      if (result.success) {
        console.log('GPS51UnifiedAuthService: Fresh authentication successful');
        return true;
      } else {
        console.error('GPS51UnifiedAuthService: Fresh authentication failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('GPS51UnifiedAuthService: Authentication initialization failed:', error);
      this.clearAuthenticationState();
      return false;
    }
  }
}

export const gps51UnifiedAuthService = GPS51UnifiedAuthService.getInstance();