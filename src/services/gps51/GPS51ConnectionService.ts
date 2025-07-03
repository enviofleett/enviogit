
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { GPS51NetworkConnectivityService } from './GPS51NetworkConnectivityService';
import { GPS51ProxyClient } from './GPS51ProxyClient';
import { gps51AuthService } from './GPS51AuthenticationService';

export class GPS51ConnectionService {
  private authService = GPS51AuthService.getInstance();
  private connectivityService: GPS51NetworkConnectivityService;
  private proxyClient = GPS51ProxyClient.getInstance();
  private useProxy = false;

  constructor() {
    this.connectivityService = new GPS51NetworkConnectivityService();
  }

  isValidMD5(str: string): boolean {
    return /^[a-f0-9]{32}$/.test(str);
  }

  async connect(credentials: {
    username: string;
    password: string;
    apiKey?: string;
    apiUrl: string;
    from?: string;
    type?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('=== GPS51 CONNECTION SERVICE ENHANCED CONNECT ===');
      console.log('1. Starting connection process...');
      
      // Auto-migrate webapi to openapi endpoint
      let apiUrl = credentials.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51ConnectionService: Auto-migrating API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }
      
      // Use enhanced authentication service
      console.log('2. Using enhanced authentication service...');
      
      const authCredentials: GPS51Credentials = {
        username: credentials.username,
        password: credentials.password,
        apiKey: credentials.apiKey,
        apiUrl: apiUrl,
        from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
      };
      
      const authResult = await gps51AuthService.authenticate(authCredentials);
      
      if (authResult.success) {
        // Save configuration
        await gps51ConfigService.saveConfiguration(authCredentials);
        
        // Store authentication results
        if (authResult.token) {
          localStorage.setItem('gps51_auth_token', authResult.token);
        }
        localStorage.setItem('gps51_use_proxy', authResult.method === 'proxy' ? 'true' : 'false');
        
        console.log(`GPS51ConnectionService: Authentication successful via ${authResult.method}`);
        return { success: true };
      } else {
        throw new Error(authResult.error || 'Authentication failed');
      }
      
    } catch (error) {
      console.error('GPS51 connection process failed:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      // Enhanced error guidance
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. This indicates:\n• CORS restrictions preventing direct browser access\n• Network firewall blocking requests\n• GPS51 API server issues\n\nThe system tried both proxy and direct connections but both failed. Please check your network connectivity.';
      } else if (errorMessage.includes('8901')) {
        errorMessage += '\n\nTroubleshooting tips:\n• Verify your username and password are correct\n• Ensure you are using the correct API URL\n• Check that your account has proper permissions\n• Contact GPS51 support if credentials are definitely correct';
      } else if (errorMessage.includes('Login failed') || errorMessage.includes('Authentication failed')) {
        errorMessage += '\n\nPossible causes:\n• Incorrect username/password\n• Account locked or suspended\n• API endpoint not reachable\n• Invalid from/type parameters\n• Password needs to be MD5 hashed';
      } else if (errorMessage.includes('Proxy')) {
        errorMessage += '\n\nProxy connection issues:\n• Supabase Edge Function may be down\n• GPS51 API may be blocking our proxy server\n• Network connectivity issues';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  private async connectDirect(credentials: any, apiUrl: string): Promise<{ success: boolean; error?: string }> {
    console.log('GPS51ConnectionService: Attempting direct connection...');
    
    // Validate input credentials
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required');
    }
    
    if (!apiUrl) {
      throw new Error('API URL is required');
    }
    
    // Prepare auth credentials
    const authCredentials: GPS51Credentials = {
      username: credentials.username,
      password: credentials.password, // Should already be MD5 hashed
      apiKey: credentials.apiKey,
      apiUrl: apiUrl,
      from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
      type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
    };
    
    // Save configuration first
    await gps51ConfigService.saveConfiguration(authCredentials);
    
    // Authenticate using direct connection
    const token = await this.authService.authenticate(authCredentials);
    
    if (!token || !token.access_token) {
      throw new Error('Authentication failed - no token received');
    }
    
    console.log('GPS51ConnectionService: Direct authentication successful');
    return { success: true };
  }

  private async connectViaProxy(credentials: any, apiUrl: string): Promise<{ success: boolean; error?: string }> {
    console.log('GPS51ConnectionService: Attempting proxy connection...');
    
    // Validate credentials first
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required for proxy authentication');
    }
    
    // Generate a proper authentication token for GPS51 API
    const authToken = this.generateAuthToken(credentials.username, credentials.password);
    
    try {
      const authResult = await this.proxyClient.makeRequest(
        'login',
        authToken,
        {
          username: credentials.username,
          password: credentials.password,
          from: credentials.from || 'WEB',
          type: credentials.type || 'USER'
        },
        'POST',
        apiUrl
      );
      
      console.log('GPS51ConnectionService: Proxy auth result:', {
        status: authResult.status,
        message: authResult.message,
        hasToken: !!authResult.token,
        hasUser: !!authResult.user
      });
      
      if (authResult.status === 0 && authResult.token) {
        // Save configuration for proxy use
        const authCredentials: GPS51Credentials = {
          username: credentials.username,
          password: credentials.password,
          apiKey: credentials.apiKey,
          apiUrl: apiUrl,
          from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
          type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
        };
        
        await gps51ConfigService.saveConfiguration(authCredentials);
        
        // Store proxy preference and auth token
        localStorage.setItem('gps51_use_proxy', 'true');
        localStorage.setItem('gps51_auth_token', authResult.token);
        
        console.log('GPS51ConnectionService: Proxy authentication successful');
        return { success: true };
      } else {
        const errorMsg = authResult.message || `Authentication failed with status: ${authResult.status}`;
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('GPS51ConnectionService: Proxy authentication error:', error);
      throw new Error(`Proxy authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateAuthToken(username: string, password: string): string {
    // Generate a simple token for GPS51 API - this should be MD5 hash in production
    const timestamp = Date.now().toString();
    const tokenString = `${username}-${password}-${timestamp}`;
    return btoa(tokenString).substring(0, 32);
  }

  disconnect(): void {
    this.authService.logout();
    gps51ConfigService.clearConfiguration();
    console.log('GPS51ConnectionService: Disconnected');
  }

  async refresh(): Promise<any> {
    console.log('Starting GPS51 data refresh...');
    
    const result = await gps51ConfigService.syncData();
    
    if (result.success) {
      console.log('GPS51 data refresh successful:', result);
      return result;
    } else {
      throw new Error(result.error || 'Sync failed');
    }
  }
}
