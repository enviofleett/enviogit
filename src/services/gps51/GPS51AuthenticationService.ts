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
   * Authenticate using proxy-only approach with retry logic
   */
  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthenticationResult> {
    return this.authenticateWithRetry(credentials, 3);
  }

  /**
   * Authenticate with retry mechanism for transient failures
   */
  private async authenticateWithRetry(credentials: GPS51Credentials, maxRetries: number): Promise<GPS51AuthenticationResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        console.log(`GPS51AuthenticationService: Authentication attempt ${attempt}/${maxRetries}...`);
        
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
          type: loginParams.type,
          attempt
        });

        // CRITICAL: Use gps51-auth Edge Function for login only
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: response, error: edgeFunctionError } = await supabase.functions.invoke('gps51-auth', {
          body: {
            action: 'login',
            username: loginParams.username,
            password: loginParams.password,
            from: loginParams.from,
            type: loginParams.type,
            apiUrl
          }
        });

        if (edgeFunctionError) {
          throw new Error(`Edge Function error: ${edgeFunctionError.message}`);
        }

        if (!response) {
          throw new Error('No response from Edge Function');
        }

        const responseTime = Date.now() - startTime;

        console.log('GPS51AuthenticationService: Proxy authentication response:', {
          status: response.status,
          message: response.message,
          cause: response.cause,
          hasToken: !!response.token,
          hasUser: !!response.user,
          responseTime,
          attempt
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
          
          lastError = errorMessage;
          
          // Don't retry authentication failures (wrong credentials)
          if (response.status === 1 || response.status === 8901) {
            return {
              success: false,
              error: errorMessage,
              responseTime
            };
          }
          
          // Retry for other errors
          if (attempt < maxRetries) {
            console.warn(`GPS51AuthenticationService: Attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            continue;
          }
          
          return {
            success: false,
            error: errorMessage,
            responseTime
          };
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.error(`GPS51AuthenticationService: Authentication attempt ${attempt} failed:`, {
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
        } else if (errorMessage.includes('FunctionsHttpError')) {
          errorMessage = 'GPS51 Edge Function error. Service may be temporarily unavailable.';
        }
        
        lastError = errorMessage;
        
        // Retry for network errors
        if (attempt < maxRetries && (
          errorMessage.includes('Network connection failed') ||
          errorMessage.includes('temporarily unavailable') ||
          errorMessage.includes('Edge Function error')
        )) {
          console.warn(`GPS51AuthenticationService: Attempt ${attempt} failed with network error, retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        
        return {
          success: false,
          error: errorMessage,
          responseTime
        };
      }
    }
    
    return {
      success: false,
      error: `Authentication failed after ${maxRetries} attempts. Last error: ${lastError}`,
      responseTime: 0
    };
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