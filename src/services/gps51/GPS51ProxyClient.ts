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
    apiUrl?: string
  ): Promise<GPS51ApiResponse> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`GPS51ProxyClient: Making request via Supabase Edge Function (attempt ${attempt}/${maxRetries}):`, {
          action,
          hasToken: !!token,
          params,
          method,
          apiUrl
        });

        const requestData: GPS51ProxyRequestData = {
          action,
          token,
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
          proxyMetadata: data.proxy_metadata
        });

        // Validate response
        if (data.proxy_error) {
          throw new Error(`Proxy error: ${data.error || 'Unknown proxy error'}`);
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
      const result = await this.makeRequest(
        'login',
        'test-token',
        { username: 'test', password: 'test' },
        'POST',
        apiUrl
      );
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}