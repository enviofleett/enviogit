
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51AuthService } from '../gp51/GPS51AuthService';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { GPS51NetworkConnectivityService } from './GPS51NetworkConnectivityService';
import { GPS51ProxyClient } from './GPS51ProxyClient';

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
      
      // Phase 1: Test connectivity first
      console.log('2. Testing network connectivity...');
      this.connectivityService = new GPS51NetworkConnectivityService(apiUrl);
      const diagnosis = await this.connectivityService.diagnoseConnectivityIssues();
      
      console.log('3. Connectivity diagnosis:', {
        canProceed: diagnosis.canProceed,
        suggestEdgeFunction: diagnosis.suggestEdgeFunction,
        issues: diagnosis.issues,
        recommendations: diagnosis.recommendations
      });

      // Decide whether to use proxy based on connectivity test
      this.useProxy = diagnosis.suggestEdgeFunction || !diagnosis.canProceed;
      
      if (this.useProxy) {
        console.log('4. Using proxy connection due to connectivity issues');
        return await this.connectViaProxy(credentials, apiUrl);
      } else {
        console.log('4. Using direct connection - connectivity test passed');
        return await this.connectDirect(credentials, apiUrl);
      }
      
    } catch (error) {
      console.error('GPS51 connection process failed:', error);
      
      // Fallback to proxy if direct connection fails
      if (!this.useProxy) {
        console.log('5. Direct connection failed, trying proxy fallback...');
        try {
          return await this.connectViaProxy(credentials, credentials.apiUrl);
        } catch (proxyError) {
          console.error('Proxy fallback also failed:', proxyError);
        }
      }
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      // Enhanced error guidance
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. This could be due to:\n• CORS restrictions\n• Network firewall\n• GPS51 API server issues\n\nTry enabling proxy mode for better reliability.';
      } else if (errorMessage.includes('8901')) {
        errorMessage += '\n\nTroubleshooting tips:\n• Verify your username and password are correct\n• Ensure you are using the correct API URL\n• Check that your account has proper permissions';
      } else if (errorMessage.includes('Login failed')) {
        errorMessage += '\n\nPossible causes:\n• Incorrect username/password\n• Account locked or suspended\n• API endpoint not reachable\n• Invalid from/type parameters';
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
    
    // Test proxy connection first
    const proxyTest = await this.proxyClient.testConnection(apiUrl);
    if (!proxyTest.success) {
      throw new Error(`Proxy connection failed: ${proxyTest.error}`);
    }
    
    // Try authentication via proxy
    try {
      const authResult = await this.proxyClient.makeRequest(
        'login',
        'test-token', // Will be replaced with actual token
        {
          username: credentials.username,
          password: credentials.password
        },
        'POST',
        apiUrl
      );
      
      if (authResult.status === 1 || authResult.token) {
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
        
        // Store proxy preference
        localStorage.setItem('gps51_use_proxy', 'true');
        
        console.log('GPS51ConnectionService: Proxy authentication successful');
        return { success: true };
      } else {
        throw new Error(authResult.message || 'Proxy authentication failed');
      }
    } catch (error) {
      throw new Error(`Proxy authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
