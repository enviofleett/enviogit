import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51ApiClient } from './GPS51ApiClient';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { md5 } from 'js-md5';

export interface AuthenticationResult {
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
  method: 'proxy' | 'direct';
}

export interface EndpointVariation {
  type: string;
  url: string;
}

export interface ParameterFormat {
  name: string;
  params: Record<string, any>;
}

export class GPS51AuthenticationService {
  private static instance: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;
  private apiClient: GPS51ApiClient;

  private constructor() {
    this.proxyClient = GPS51ProxyClient.getInstance();
    this.apiClient = new GPS51ApiClient();
  }

  static getInstance(): GPS51AuthenticationService {
    if (!GPS51AuthenticationService.instance) {
      GPS51AuthenticationService.instance = new GPS51AuthenticationService();
    }
    return GPS51AuthenticationService.instance;
  }

  async authenticate(credentials: GPS51Credentials): Promise<AuthenticationResult> {
    console.log('GPS51AuthenticationService: Starting enhanced authentication process');

    // Ensure password is MD5 hashed
    const hashedPassword = this.ensurePasswordHashed(credentials.password);
    
    const authCredentials = {
      ...credentials,
      password: hashedPassword
    };

    // Test multiple endpoints and parameter formats
    const endpointVariations = this.getEndpointVariations(credentials.apiUrl);
    const parameterFormats = this.getParameterFormats(authCredentials);

    console.log('GPS51AuthenticationService: Testing multiple configurations:', {
      endpointCount: endpointVariations.length,
      parameterFormatCount: parameterFormats.length
    });

    let lastError: string = '';
    let attempts = 0;

    // Try each endpoint with each parameter format
    for (const endpoint of endpointVariations) {
      for (const paramFormat of parameterFormats) {
        attempts++;
        console.log(`GPS51AuthenticationService: Attempt ${attempts} - Endpoint: ${endpoint.type}, Params: ${paramFormat.name}`);
        
        try {
          // Update credentials with current endpoint
          const testCredentials = { ...authCredentials, apiUrl: endpoint.url };
          
          // Try proxy authentication first (most reliable)
          try {
            const proxyResult = await this.authenticateViaProxy(testCredentials, paramFormat);
            if (proxyResult.success && proxyResult.token) {
              console.log(`GPS51AuthenticationService: SUCCESS via proxy - Endpoint: ${endpoint.type}, Params: ${paramFormat.name}`);
              return proxyResult;
            }
          } catch (error) {
            console.warn(`GPS51AuthenticationService: Proxy failed for ${endpoint.type} with ${paramFormat.name}:`, error);
          }

          // Fallback to direct authentication
          try {
            const directResult = await this.authenticateDirectly(testCredentials, paramFormat);
            if (directResult.success && directResult.token) {
              console.log(`GPS51AuthenticationService: SUCCESS via direct - Endpoint: ${endpoint.type}, Params: ${paramFormat.name}`);
              return directResult;
            }
          } catch (error) {
            console.warn(`GPS51AuthenticationService: Direct failed for ${endpoint.type} with ${paramFormat.name}:`, error);
          }
          
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`GPS51AuthenticationService: Configuration failed:`, {
            endpoint: endpoint.type,
            parameterFormat: paramFormat.name,
            error: lastError
          });
        }
      }
    }

    console.error('GPS51AuthenticationService: All authentication methods failed after', attempts, 'attempts');
    
    return {
      success: false,
      error: `Authentication failed after ${attempts} attempts. Last error: ${lastError}. Please verify your credentials and API URL.`,
      method: 'direct'
    };
  }

  private getEndpointVariations(apiUrl: string): EndpointVariation[] {
    const variations: EndpointVariation[] = [];
    
    // Primary: Use OpenAPI endpoint as primary source of truth
    if (!apiUrl.includes('/openapi')) {
      variations.push({ 
        type: 'openapi_primary', 
        url: 'https://api.gps51.com/openapi' 
      });
    } else {
      variations.push({ type: 'openapi_original', url: apiUrl });
    }
    
    // Secondary: Test original URL if different from primary
    if (apiUrl !== 'https://api.gps51.com/openapi') {
      variations.push({ type: 'original', url: apiUrl });
    }
    
    // Fallback: Test /webapi endpoint as legacy fallback
    if (apiUrl.includes('/openapi')) {
      variations.push({ 
        type: 'webapi_fallback', 
        url: apiUrl.replace('/openapi', '/webapi') 
      });
    } else if (!apiUrl.includes('/webapi')) {
      variations.push({ 
        type: 'webapi_fallback', 
        url: apiUrl.replace(/\/$/, '') + '/webapi' 
      });
    }
    
    return variations;
  }

  private getParameterFormats(credentials: GPS51Credentials): ParameterFormat[] {
    return [
      {
        name: 'standard',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: credentials.from || 'WEB',
          type: credentials.type || 'USER'
        }
      },
      {
        name: 'extended',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: credentials.from || 'WEB',
          type: credentials.type || 'USER',
          platform: 'web',
          version: '1.0'
        }
      },
      {
        name: 'minimal',
        params: {
          username: credentials.username,
          password: credentials.password
        }
      },
      {
        name: 'android_format',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: 'ANDROID',
          type: 'USER'
        }
      }
    ];
  }

  private async authenticateViaProxy(credentials: GPS51Credentials, paramFormat?: ParameterFormat): Promise<AuthenticationResult> {
    console.log('GPS51AuthenticationService: Attempting proxy authentication');

    const authToken = this.generateAuthToken(credentials.username, credentials.password);
    
    // Use custom parameter format if provided, otherwise use default
    const params = paramFormat ? paramFormat.params : {
      username: credentials.username,
      password: credentials.password,
      from: credentials.from || 'WEB',
      type: credentials.type || 'USER'
    };
    
    console.log('GPS51AuthenticationService: Proxy request params:', {
      parameterFormat: paramFormat?.name || 'default',
      params: { ...params, password: '[HIDDEN]' }
    });
    
    const response = await this.proxyClient.makeRequest(
      'login',
      authToken,
      params,
      'POST',
      credentials.apiUrl
    );

    console.log('GPS51AuthenticationService: Proxy response:', {
      status: response.status,
      hasToken: !!response.token,
      hasUser: !!response.user,
      message: response.message,
      isEmpty: !response.token && !response.user && !response.data
    });

    if (response.status === 0) {
      if (response.token) {
        return {
          success: true,
          token: response.token,
          user: response.user,
          method: 'proxy'
        };
      } else {
        // Success status but no token - this is the main issue we're seeing
        console.warn('GPS51AuthenticationService: Success status but empty response - GPS51 API may have authentication issues');
        return {
          success: false,
          error: 'Authentication succeeded but no token received. This may indicate GPS51 API issues or incorrect parameters.',
          method: 'proxy'
        };
      }
    } else {
      return {
        success: false,
        error: response.message || `Authentication failed with status ${response.status}`,
        method: 'proxy'
      };
    }
  }

  private async authenticateDirectly(credentials: GPS51Credentials, paramFormat?: ParameterFormat): Promise<AuthenticationResult> {
    console.log('GPS51AuthenticationService: Attempting direct authentication');

    this.apiClient.setBaseURL(credentials.apiUrl);
    
    const authToken = this.generateAuthToken(credentials.username, credentials.password);
    
    // Use custom parameter format if provided, otherwise use default
    const params = paramFormat ? paramFormat.params : {
      username: credentials.username,
      password: credentials.password,
      from: credentials.from || 'WEB',
      type: credentials.type || 'USER'
    };
    
    console.log('GPS51AuthenticationService: Direct request params:', {
      parameterFormat: paramFormat?.name || 'default',
      params: { ...params, password: '[HIDDEN]' },
      apiUrl: credentials.apiUrl
    });
    
    const response = await this.apiClient.makeRequest(
      'login',
      authToken,
      params,
      'POST'
    );

    console.log('GPS51AuthenticationService: Direct response:', {
      status: response.status,
      hasToken: !!response.token,
      hasUser: !!response.user,
      message: response.message,
      isEmpty: !response.token && !response.user && !response.data
    });

    if (response.status === 0) {
      if (response.token) {
        return {
          success: true,
          token: response.token,
          user: response.user,
          method: 'direct'
        };
      } else {
        // Success status but no token - this is the main issue we're seeing
        console.warn('GPS51AuthenticationService: Success status but empty response - GPS51 API may have authentication issues');
        return {
          success: false,
          error: 'Authentication succeeded but no token received. This may indicate GPS51 API issues or incorrect parameters.',
          method: 'direct'
        };
      }
    } else {
      return {
        success: false,
        error: response.message || `Authentication failed with status ${response.status}`,
        method: 'direct'
      };
    }
  }

  private ensurePasswordHashed(password: string): string {
    // Check if password is already MD5 hashed (32 hex characters)
    if (/^[a-f0-9]{32}$/.test(password)) {
      return password;
    }
    
    // Hash the password with MD5
    return md5(password);
  }

  private generateAuthToken(username: string, password: string): string {
    // Generate a simple token for GPS51 API
    const timestamp = Date.now().toString();
    const tokenString = `${username}-${password}-${timestamp}`;
    return btoa(tokenString).substring(0, 32);
  }

  async testConnection(apiUrl: string): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Test with both proxy and direct methods
      const proxyTest = await this.proxyClient.testConnection(apiUrl);
      const responseTime = Date.now() - startTime;
      
      return {
        success: proxyTest.success,
        responseTime,
        error: proxyTest.error
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

export const gps51AuthService = GPS51AuthenticationService.getInstance();