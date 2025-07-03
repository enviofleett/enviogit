
import { gps51ConfigService } from '../gp51/GPS51ConfigService';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { GPS51NetworkConnectivityService } from './GPS51NetworkConnectivityService';
import { gps51IntelligentConnectionManager } from './GPS51IntelligentConnectionManager';

export class GPS51ConnectionService {
  private connectivityService: GPS51NetworkConnectivityService;
  private connectionManager = gps51IntelligentConnectionManager;

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
      console.log('=== GPS51 CONNECTION SERVICE WITH INTELLIGENT CONNECTION MANAGER ===');
      console.log('1. Starting connection process with intelligent strategy selection...');
      
      // Validate input credentials
      if (!credentials.username || !credentials.password || !credentials.apiUrl) {
        throw new Error('Username, password, and API URL are required');
      }
      
      // Normalize API URL
      let apiUrl = credentials.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51ConnectionService: Auto-migrating API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }
      
      const authCredentials: GPS51Credentials = {
        username: credentials.username,
        password: credentials.password,
        apiKey: credentials.apiKey,
        apiUrl: apiUrl,
        from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
        type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
      };
      
      console.log('GPS51ConnectionService: Starting intelligent authentication:', {
        username: credentials.username,
        hasPassword: !!credentials.password,
        apiUrl: apiUrl,
        from: authCredentials.from,
        type: authCredentials.type
      });
      
      // Use intelligent connection manager for best strategy selection
      const connectionResult = await this.connectionManager.connectWithBestStrategy(authCredentials);
      
      console.log('GPS51ConnectionService: Intelligent connection result:', {
        success: connectionResult.success,
        strategy: connectionResult.strategy,
        responseTime: connectionResult.responseTime,
        hasToken: !!connectionResult.token,
        error: connectionResult.error
      });
      
      if (connectionResult.success && connectionResult.token) {
        // Save configuration
        await gps51ConfigService.saveConfiguration(authCredentials);
        
        // Store authentication results with strategy information
        localStorage.setItem('gps51_auth_token', connectionResult.token);
        localStorage.setItem('gps51_connection_strategy', connectionResult.strategy);
        localStorage.setItem('gps51_last_response_time', connectionResult.responseTime.toString());
        
        // Trigger authentication success events
        window.dispatchEvent(new CustomEvent('gps51-authentication-changed', { 
          detail: { 
            authenticated: true, 
            strategy: connectionResult.strategy,
            responseTime: connectionResult.responseTime
          } 
        }));
        
        console.log(`GPS51ConnectionService: Authentication successful via ${connectionResult.strategy} strategy (${connectionResult.responseTime}ms)`);
        return { success: true };
      } else {
        throw new Error(connectionResult.error || 'Authentication failed - no token received');
      }
      
    } catch (error) {
      console.error('GPS51 connection process failed:', error);
      
      let errorMessage = error instanceof Error ? error.message : 'Connection failed';
      
      // Get connection health for better error context
      const healthStatus = this.connectionManager.getConnectionHealth();
      
      // Enhanced error guidance based on intelligent connection analysis
      if (healthStatus.overallHealth === 'poor') {
        errorMessage += '\n\n🔴 Connection Health: Poor - All connection strategies failed';
        errorMessage += '\n• Proxy connection: Unavailable';
        errorMessage += '\n• Direct connection: Unavailable (CORS restrictions)';
        errorMessage += '\n• Recommendation: Check GPS51 API status and network connectivity';
      } else if (healthStatus.overallHealth === 'degraded') {
        errorMessage += '\n\n🟡 Connection Health: Degraded - Limited connectivity';
        errorMessage += `\n• Recommended strategy: ${healthStatus.recommendedStrategy}`;
        errorMessage += '\n• Some connection methods are experiencing issues';
      }
      
      // Add specific troubleshooting based on error patterns
      if (errorMessage.includes('All connection strategies failed')) {
        errorMessage += '\n\nTroubleshooting steps:';
        errorMessage += '\n• Verify GPS51 credentials are correct';
        errorMessage += '\n• Check if GPS51 API server is accessible';
        errorMessage += '\n• Ensure Supabase Edge Functions are working';
        errorMessage += '\n• Try again in a few minutes if this is a temporary issue';
      }
      
      // Trigger authentication failure event
      window.dispatchEvent(new CustomEvent('gps51-authentication-changed', { 
        detail: { 
          authenticated: false, 
          error: errorMessage,
          connectionHealth: healthStatus
        } 
      }));
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Test connection health using intelligent connection manager
   */
  async testConnection(apiUrl?: string): Promise<{ success: boolean; responseTime: number; error?: string; healthStatus?: any }> {
    try {
      const healthStatus = this.connectionManager.getConnectionHealth();
      const testResults = await this.connectionManager.testAllConnections(apiUrl);
      
      const proxyResult = testResults.get('proxy');
      
      return {
        success: proxyResult?.success || false,
        responseTime: proxyResult?.responseTime || 0,
        error: proxyResult?.error,
        healthStatus
      };
    } catch (error) {
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  disconnect(): void {
    // Clear stored authentication data
    localStorage.removeItem('gps51_auth_token');
    localStorage.removeItem('gps51_connection_strategy');
    localStorage.removeItem('gps51_last_response_time');
    
    // Clear configuration
    gps51ConfigService.clearConfiguration();
    
    // Reset connection health tracking
    this.connectionManager.resetHealthTracking();
    
    console.log('GPS51ConnectionService: Disconnected and reset');
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
