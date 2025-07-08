import { GPS51ApiResponse } from './GPS51Types';
import { GPS51_DEFAULTS } from './GPS51Constants';
import { GPS51RateLimitError } from './GPS51RateLimitError';
import { supabase } from '@/integrations/supabase/client';

export class GPS51ApiClient {
  private baseURL: string;
  private retryCount = 0;
  private maxRetries = GPS51_DEFAULTS.MAX_RETRIES;
  private retryDelay = GPS51_DEFAULTS.RETRY_DELAY;

  constructor(baseURL = GPS51_DEFAULTS.BASE_URL) {
    this.baseURL = baseURL;
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  async makeRequest(
    action: string, 
    token: string,
    params: Record<string, any> = {}, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const startTime = Date.now();
    
    const logApiCall = async (
      endpoint: string,
      requestPayload: any,
      responseStatus: number,
      responseBody: any,
      durationMs: number,
      errorMessage?: string
    ) => {
      // EMERGENCY: Disable API logging to prevent feedback loops
      // Only critical errors are logged to console
      if (errorMessage) {
        console.error(`GPS51-${endpoint} failed:`, errorMessage);
      }
    };

    try {
      console.log(`GPS51 API Request: ${action}`, { 
        method,
        params,
        baseURL: this.baseURL
      });
      
      // CRITICAL FIX: Use Supabase Edge Function proxy instead of direct fetch
      // This prevents CORS "Failed to fetch" errors
      console.log('GPS51ApiClient: Routing request through Supabase Edge Function proxy...');
      
      const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action,
          token: action === 'login' ? undefined : token,
          params,
          method,
          apiUrl: this.baseURL
        }
      });

      if (proxyError) {
        throw new Error(`Proxy request failed: ${proxyError.message}`);
      }

      if (!proxyResponse) {
        throw new Error('No data received from proxy');
      }

      // Return the proxy response as GPS51ApiResponse
      const data = proxyResponse;
      
      console.log(`GPS51 API Proxy Response (${action}):`, {
        status: data.status,
        message: data.message,
        cause: data.cause,
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasData: !!data.data,
        hasGroups: !!data.groups,
        hasRecords: !!data.records,
        proxyMetadata: data.proxy_metadata
      });

      // Validate proxy response
      if (data.proxy_error) {
        throw new Error(`Proxy error: ${data.error || 'Unknown proxy error'}`);
      }

      // Check for rate limiting status 8902
      if (data.status === 8902) {
        console.warn('GPS51 API Rate Limit Detected (Status 8902):', {
          action,
          message: data.message,
          cause: data.cause,
          retryAfter: 5000
        });
        throw GPS51RateLimitError.fromApiResponse(data);
      }

      this.retryCount = 0;
      this.retryDelay = GPS51_DEFAULTS.RETRY_DELAY;

      // Log successful API call
      const duration = Date.now() - startTime;
      await logApiCall(action, params, 200, data, duration);

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, {
        error: error.message,
        params,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      // Handle rate limiting with exponential backoff
      if (GPS51RateLimitError.isRateLimitError(error)) {
        const rateLimitError = error as GPS51RateLimitError;
        const delay = Math.max(rateLimitError.retryAfter, 5000); // Minimum 5 seconds
        
        console.warn(`GPS51 Rate Limit: Waiting ${delay}ms before retry (${this.retryCount + 1}/${this.maxRetries})`);
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(action, token, params, method);
        } else {
          throw new GPS51RateLimitError('GPS51 API rate limit exceeded after all retries. Please wait before making more requests.');
        }
      }
      
      // Standard retry logic for other errors
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Retrying GPS51 request (${this.retryCount}/${this.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(action, token, params, method);
      }

      // Log failed API call
      const duration = Date.now() - startTime;
      await logApiCall(action, params, 0, null, duration, error.message);

      throw error;
    }
  }

  resetRetryState(): void {
    this.retryCount = 0;
    this.retryDelay = GPS51_DEFAULTS.RETRY_DELAY;
  }
}