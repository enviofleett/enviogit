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
    try {
      console.log('GPS51ProxyClient: Making request via Supabase Edge Function:', {
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

      return data;
    } catch (error) {
      console.error('GPS51ProxyClient: Request failed:', error);
      throw new Error(`Proxy client error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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