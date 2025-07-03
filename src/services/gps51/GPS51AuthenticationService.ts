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
    console.log('GPS51AuthenticationService: Starting authentication process');

    // Ensure password is MD5 hashed
    const hashedPassword = this.ensurePasswordHashed(credentials.password);
    
    const authCredentials = {
      ...credentials,
      password: hashedPassword
    };

    // Try proxy authentication first (most reliable)
    try {
      const proxyResult = await this.authenticateViaProxy(authCredentials);
      if (proxyResult.success) {
        return proxyResult;
      }
    } catch (error) {
      console.warn('GPS51AuthenticationService: Proxy authentication failed:', error);
    }

    // Fallback to direct authentication
    try {
      const directResult = await this.authenticateDirectly(authCredentials);
      return directResult;
    } catch (error) {
      console.error('GPS51AuthenticationService: Direct authentication failed:', error);
      
      return {
        success: false,
        error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        method: 'direct'
      };
    }
  }

  private async authenticateViaProxy(credentials: GPS51Credentials): Promise<AuthenticationResult> {
    console.log('GPS51AuthenticationService: Attempting proxy authentication');

    const authToken = this.generateAuthToken(credentials.username, credentials.password);
    
    const response = await this.proxyClient.makeRequest(
      'login',
      authToken,
      {
        username: credentials.username,
        password: credentials.password,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      },
      'POST',
      credentials.apiUrl
    );

    if (response.status === 1 && response.token) {
      return {
        success: true,
        token: response.token,
        user: response.user,
        method: 'proxy'
      };
    } else {
      return {
        success: false,
        error: response.message || 'Proxy authentication failed',
        method: 'proxy'
      };
    }
  }

  private async authenticateDirectly(credentials: GPS51Credentials): Promise<AuthenticationResult> {
    console.log('GPS51AuthenticationService: Attempting direct authentication');

    this.apiClient.setBaseURL(credentials.apiUrl);
    
    const authToken = this.generateAuthToken(credentials.username, credentials.password);
    
    const response = await this.apiClient.makeRequest(
      'login',
      authToken,
      {
        username: credentials.username,
        password: credentials.password,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      },
      'POST'
    );

    if (response.status === 1 && response.token) {
      return {
        success: true,
        token: response.token,
        user: response.user,
        method: 'direct'
      };
    } else {
      return {
        success: false,
        error: response.message || 'Direct authentication failed',
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