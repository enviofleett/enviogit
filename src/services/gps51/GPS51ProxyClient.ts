import { supabase } from '@/integrations/supabase/client';
import { GPS51ApiResponse } from './GPS51Types';
import { gps51CentralizedRequestManager } from './GPS51CentralizedRequestManager';

export interface GPS51ProxyRequestData {
  action: string;
  token?: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  apiUrl?: string;
}

export class GPS51ProxyClient {
  private static instance: GPS51ProxyClient;
  
  static getInstance(): GPS51ProxyClient {
    if (!GPS51ProxyClient.instance) {
      GPS51ProxyClient.instance = new GPS51ProxyClient();
    }
    return GPS51ProxyClient.instance;
  }

  async makeRequest(
    action: string,
    token: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'POST',
    apiUrl: string = 'https://api.gps51.com/openapi'
  ): Promise<GPS51ApiResponse> {
    // PHASE 1 FIX: Route through centralized request manager
    console.log('GPS51ProxyClient: Routing request through centralized manager');
    return gps51CentralizedRequestManager.makeRequest(action, params, method, token, 'normal');
    // REMOVED: All retry logic now handled by centralized manager
  }

  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
    healthStatus?: any;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51ProxyClient: Testing production-ready Edge Function health...');
      
      // Test with a simple health check that should work regardless of credentials
      const testUrl = apiUrl || 'https://api.gps51.com/openapi';
      
      console.log(`GPS51ProxyClient: Testing connection to ${testUrl}`);
      
      // PRODUCTION FIX: Use a lightweight health check request
      const { data, error } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'login',
          params: { 
            username: 'health-check', 
            password: 'health-check-password',
            from: 'WEB',
            type: 'USER'
          },
          method: 'POST',
          apiUrl: testUrl
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        console.error('GPS51ProxyClient: Edge Function invoke error:', error);
        return {
          success: false,
          responseTime,
          error: `Edge Function communication failed: ${error.message}`,
          healthStatus: {
            edgeFunctionStatus: 'Error',
            error: error.message
          }
        };
      }
      
      if (!data) {
        console.warn('GPS51ProxyClient: Edge Function returned no data');
        return {
          success: false,
          responseTime,
          error: 'Edge Function returned no response - deployment issue detected',
          healthStatus: {
            edgeFunctionStatus: 'No Response',
            recommendation: 'Check Edge Function deployment'
          }
        };
      }
      
      // ENHANCED: Analyze response to determine connection quality
      const healthStatus = {
        edgeFunctionStatus: 'Operational',
        responseTime: `${responseTime}ms`,
        apiConnectivity: data.proxy_error ? 'Failed' : 'Success',
        performanceRating: responseTime < 1000 ? 'Excellent' : responseTime < 3000 ? 'Good' : 'Slow',
        recommendation: responseTime > 2000 ? 'Consider performance optimization' : 'Connection optimal'
      };
      
      console.log('GPS51ProxyClient: Edge Function health assessment:', {
        hasData: !!data,
        responseTime,
        dataStatus: data.status,
        dataType: typeof data,
        hasProxyError: !!data.proxy_error,
        healthStatus
      });
      
      // Even failed authentication is considered successful for connectivity testing
      return {
        success: true,
        responseTime,
        healthStatus
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      console.error('GPS51ProxyClient: Connection test exception:', error);
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown connection test error',
        healthStatus: {
          edgeFunctionStatus: 'Exception',
          error: error instanceof Error ? error.message : 'Unknown error',
          recommendation: 'Check network connectivity and Edge Function status'
        }
      };
    }
  }
}