import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51Utils } from './GPS51Utils';
import { GPS51_STATUS } from './GPS51Constants';

export interface GPS51AuthenticationResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  diagnostics?: {
    requestDuration: number;
    responseStatus: number;
    proxyMetadata?: any;
  };
}

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

  async authenticate(credentials: {
    username: string;
    password: string;
    apiUrl?: string;
    from?: string;
    type?: string;
  }): Promise<GPS51AuthenticationResult> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51AuthenticationService: Starting enhanced authentication...');
      
      // Validate and prepare credentials
      const loginParams = this.prepareLoginParams(credentials);
      
      console.log('GPS51AuthenticationService: Login parameters prepared:', {
        username: loginParams.username,
        passwordIsHashed: GPS51Utils.validateMD5Hash(loginParams.password),
        passwordLength: loginParams.password.length,
        from: loginParams.from,
        type: loginParams.type,
        apiUrl: credentials.apiUrl || 'https://api.gps51.com/openapi'
      });

      // Make authentication request through proxy
      const response = await this.proxyClient.makeRequest(
        'login',
        '', // No token needed for login
        loginParams,
        'POST',
        credentials.apiUrl || 'https://api.gps51.com/openapi'
      );

      const duration = Date.now() - startTime;
      
      console.log('GPS51AuthenticationService: Authentication response received:', {
        status: response.status,
        statusType: typeof response.status,
        message: response.message,
        cause: response.cause,
        hasToken: !!response.token,
        hasUser: !!response.user,
        tokenLength: response.token?.length || 0,
        duration: `${duration}ms`,
        proxyMetadata: (response as any).proxy_metadata
      });

      // Analyze response for success/failure
      const result = this.analyzeAuthenticationResponse(response, duration);
      
      if (result.success) {
        console.log('GPS51AuthenticationService: Authentication successful:', {
          token: result.token?.substring(0, 8) + '...',
          user: result.user?.username,
          duration: `${duration}ms`
        });
      } else {
        console.error('GPS51AuthenticationService: Authentication failed:', {
          error: result.error,
          status: response.status,
          duration: `${duration}ms`
        });
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('GPS51AuthenticationService: Authentication exception:', {
        error: error.message,
        duration: `${duration}ms`,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          apiUrl: credentials.apiUrl
        }
      });

      return {
        success: false,
        error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        diagnostics: {
          requestDuration: duration,
          responseStatus: 0
        }
      };
    }
  }

  private prepareLoginParams(credentials: any): any {
    // Ensure password is MD5 hashed
    const hashedPassword = GPS51Utils.ensureMD5Hash(credentials.password);
    
    const params = {
      username: credentials.username,
      password: hashedPassword,
      from: credentials.from || 'WEB',
      type: credentials.type || 'USER'
    };

    // Validate all required parameters are present
    if (!params.username || !params.password || !params.from || !params.type) {
      throw new Error('Missing required authentication parameters');
    }

    return params;
  }

  private analyzeAuthenticationResponse(response: any, duration: number): GPS51AuthenticationResult {
    const diagnostics = {
      requestDuration: duration,
      responseStatus: (response as any).proxy_metadata?.responseStatus || 0,
      proxyMetadata: (response as any).proxy_metadata
    };

    // Check for proxy errors first
    if (response.proxy_error) {
      return {
        success: false,
        error: `Proxy error: ${response.error || 'Unknown proxy error'}`,
        diagnostics
      };
    }

    // Check GPS51 API response status
    const status = parseInt(response.status);
    
    if (status === GPS51_STATUS.SUCCESS || status === 0) {
      // Success case - validate we have required data
      if (response.token) {
        return {
          success: true,
          token: response.token,
          user: response.user,
          diagnostics
        };
      } else {
        // Success status but no token - this indicates parameter issues
        return {
          success: false,
          error: 'Authentication succeeded but no token received. This may indicate GPS51 API parameter issues.',
          diagnostics
        };
      }
    } else {
      // Error case - provide specific error messages
      let errorMessage = response.message || response.cause || `Authentication failed with status: ${status}`;
      
      if (status === 8901) {
        errorMessage = 'Authentication parameter validation failed. Check username, password hash, from, and type parameters.';
      } else if (status === 1) {
        errorMessage = 'Login failed. Verify credentials and account status.';
      } else if (status === 8902) {
        errorMessage = 'User account is disabled or suspended.';
      } else if (status === 8903) {
        errorMessage = 'Invalid user type or permissions.';
      }

      return {
        success: false,
        error: errorMessage,
        diagnostics
      };
    }
  }

  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const testUrl = apiUrl || 'https://api.gps51.com/openapi';
    
    try {
      console.log(`GPS51AuthenticationService: Testing connection to ${testUrl}`);
      
      const result = await this.proxyClient.testConnection(testUrl);
      
      console.log('GPS51AuthenticationService: Connection test result:', {
        success: result.success,
        responseTime: result.responseTime,
        error: result.error
      });
      
      return result;
    } catch (error) {
      console.error('GPS51AuthenticationService: Connection test failed:', error);
      
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

export const gps51AuthenticationService = GPS51AuthenticationService.getInstance();

// Legacy alias for backwards compatibility
export const gps51AuthService = gps51AuthenticationService;