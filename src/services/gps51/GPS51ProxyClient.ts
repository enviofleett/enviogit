import { supabase } from '@/integrations/supabase/client';
import { GPS51ApiResponse } from './GPS51Types';

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
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`GPS51ProxyClient: Making request via Supabase Edge Function (attempt ${attempt}/${maxRetries}):`, {
          action,
          hasToken: !!token,
          tokenLength: token?.length,
          params,
          method,
          apiUrl
        });

        const requestData: GPS51ProxyRequestData = {
          action,
          token: action === 'login' ? undefined : token, // Don't send token for login
          params,
          method,
          apiUrl
        };

        const { data, error } = await supabase.functions.invoke('gps51-proxy', {
          body: requestData
        });

        if (error) {
          console.error('GPS51ProxyClient: Supabase function error:', error);
          throw new Error(`Proxy request failed: ${error.message}`);
        }

        if (!data) {
          throw new Error('No data received from proxy');
        }

        console.log('GPS51ProxyClient: Received response:', {
          status: data.status,
          message: data.message,
          hasData: !!data.data,
          hasRecords: !!data.records,
          hasToken: !!data.token,
          proxyMetadata: data.proxy_metadata
        });

        // Validate response
        if (data.proxy_error) {
          throw new Error(`Proxy error: ${data.error || 'Unknown proxy error'}`);
        }

        // Enhanced response validation for GPS51
        if (action === 'login') {
          if (data.status === 0) {
            // Success status but check for actual content
            if (!data.token && !data.user && !data.data) {
              console.warn('GPS51ProxyClient: Success status but empty response detected');
              data.message = data.message || 'Authentication succeeded but received empty response. This may indicate GPS51 API parameter issues.';
            }
          }
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`GPS51ProxyClient: Request failed (attempt ${attempt}/${maxRetries}):`, lastError);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          console.log(`GPS51ProxyClient: Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Proxy client error after ${maxRetries} attempts: ${lastError.message}`);
  }

  async testConnection(apiUrl?: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51ProxyClient: Testing Edge Function health...');
      
      // Test with a simple health check that should work regardless of credentials
      const testUrl = apiUrl || 'https://api.gps51.com/openapi';
      
      console.log(`GPS51ProxyClient: Testing connection to ${testUrl}`);
      
      // Use a minimal request that tests the proxy without authentication
      const { data, error } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: 'login',
          params: { username: 'health-check', password: 'd41d8cd98f00b204e9800998ecf8427e' }, // empty string MD5
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
          error: `Edge Function error: ${error.message}`
        };
      }
      
      if (!data) {
        console.warn('GPS51ProxyClient: Edge Function returned no data');
        return {
          success: false,
          responseTime,
          error: 'Edge Function returned no data - may be a deployment issue'
        };
      }
      
      // Consider it successful if the Edge Function responded at all
      console.log('GPS51ProxyClient: Edge Function responded:', {
        hasData: !!data,
        responseTime,
        dataStatus: data.status,
        dataType: typeof data
      });
      
      return {
        success: true,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      console.error('GPS51ProxyClient: Connection test exception:', error);
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown connection test error'
      };
    }
  }
}