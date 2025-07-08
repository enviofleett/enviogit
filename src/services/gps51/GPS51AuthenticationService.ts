import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { GPS51Utils } from './GPS51Utils';

export interface GPS51AuthenticationResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  responseTime?: number;
}

/**
 * GPS51 Authentication Service - Proxy-Only Implementation
 * This service handles GPS51 authentication exclusively through Supabase Edge Functions
 * to avoid CORS "Failed to fetch" errors from direct API calls
 */
export class GPS51AuthenticationService {
  private static instance: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;

  constructor() {
    this.proxyClient = GPS51ProxyClient.getInstance();
  }

  static getInstance(): GPS51AuthenticationService {
    if (!GPS51AuthenticationService.instance) {
      GPS51AuthenticationService.instance = new GPS51AuthenticationService();
    }
    return GPS51AuthenticationService.instance;
  }

  /**
   * Authenticate using proxy-only approach to prevent CORS errors
   */
  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthenticationResult> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51AuthenticationService: Starting proxy-only authentication...');
      
      // Validate credentials format
      if (!credentials.username || !credentials.password || !credentials.apiUrl) {
        return {
          success: false,
          error: 'Username, password, and API URL are required',
          responseTime: Date.now() - startTime
        };
      }

      // Ensure password is MD5 hashed
      const hashedPassword = await GPS51Utils.ensureMD5Hash(credentials.password);
      
      // Normalize API URL
      let apiUrl = credentials.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51AuthenticationService: Auto-migrating API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }

      const loginParams = {
        username: credentials.username,
        password: hashedPassword,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      };

      console.log('GPS51AuthenticationService: Making proxy authentication request:', {
        username: loginParams.username,
        hasPassword: !!loginParams.password,
        passwordIsMD5: GPS51Utils.validateMD5Hash(loginParams.password),
        apiUrl,
        from: loginParams.from,
        type: loginParams.type
      });

      // CRITICAL: Use proxy client instead of direct API calls
      const response = await this.proxyClient.makeRequest(
        'login',
        '', // No token for login
        loginParams,
        'POST',
        apiUrl
      );

      const responseTime = Date.now() - startTime;

      console.log('GPS51AuthenticationService: Proxy authentication response:', {
        status: response.status,
        message: response.message,
        cause: response.cause,
        hasToken: !!response.token,
        hasUser: !!response.user,
        responseTime
      });

      if (response.status === 0 && response.token) {
        return {
          success: true,
          token: response.token,
          user: response.user,
          responseTime
        };
      } else {
        let errorMessage = response.message || response.cause || `Authentication failed with status: ${response.status}`;
        
        if (response.status === 8901) {
          errorMessage += ' (GPS51 parameter validation failed - check credentials format)';
        } else if (response.status === 1) {
          errorMessage += ' (GPS51 login failed - verify username and password)';
        }
        
        return {
          success: false,
          error: errorMessage,
          responseTime
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      console.error('GPS51AuthenticationService: Authentication failed:', {
        error: error.message,
        stack: error.stack,
        responseTime
      });
      
      // Enhanced error handling for common issues
      let errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (errorMessage.includes('Proxy request failed')) {
        errorMessage = 'GPS51 service temporarily unavailable. Please try again in a few moments.';
      }
      
      return {
        success: false,
        error: errorMessage,
        responseTime
      };
    }
  }

  /**
   * Test proxy connection health
   */
  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    return await this.proxyClient.testConnection(apiUrl);
  }
}