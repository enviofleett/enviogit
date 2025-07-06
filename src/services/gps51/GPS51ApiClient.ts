
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
    const requestId = `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const logApiCall = async (
      endpoint: string,
      requestPayload: any,
      responseStatus: number,
      responseBody: any,
      durationMs: number,
      errorMessage?: string
    ) => {
      try {
        await supabase.from('api_calls_monitor').insert({
          endpoint: `GPS51-${endpoint}`,
          method,
          request_payload: requestPayload,
          response_status: responseStatus,
          response_body: responseBody,
          duration_ms: durationMs,
          error_message: errorMessage,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.warn('Failed to log API call:', logError);
      }
    };
    // Build URL with action and token as query parameters
    const url = new URL(this.baseURL);
    url.searchParams.append('action', action);
    
    // Only add token for non-login actions
    if (action !== 'login') {
      url.searchParams.append('token', token);
    }
    
    // Add undocumented parameters for lastposition action
    if (action === 'lastposition') {
      url.searchParams.append('streamtype', 'proto');
      url.searchParams.append('send', '2');
    }

    try {
      console.log(`GPS51 API Request: ${action}`, { 
        url: url.toString(), 
        method,
        params,
        baseURL: this.baseURL
      });
      
      const requestOptions: RequestInit = {
        method: method,
        headers: {
          'Accept': 'application/json',
        }
      };

      // For POST requests, use JSON for login, form-encoded for others
      if (method === 'POST' && Object.keys(params).length > 0) {
        if (action === 'login') {
          // Use JSON for login requests to OpenAPI endpoint
          requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/json',
          };
          requestOptions.body = JSON.stringify(params);
          
          console.log('GPS51 JSON Login Request Details:', {
            url: url.toString(),
            method: 'POST',
            headers: requestOptions.headers,
            bodyObject: params
          });
        } else {
          // Use form-encoded for other requests
          requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          };
          
          const formParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              formParams.append(key, value.join(','));
            } else {
              // CRITICAL FIX: Ensure timestamps are properly formatted
              if (key === 'lastquerypositiontime' && typeof value === 'number') {
                // GPS51 API expects timestamps as strings
                formParams.append(key, value.toString());
              } else {
                formParams.append(key, String(value));
              }
            }
          });
          requestOptions.body = formParams.toString();
          
          console.log('GPS51 Form POST Request Details:', {
            url: url.toString(),
            method: 'POST',
            headers: requestOptions.headers,
            body: requestOptions.body,
            bodyObject: params,
            timestampFormatting: params.lastquerypositiontime ? {
              originalValue: params.lastquerypositiontime,
              formattedValue: String(params.lastquerypositiontime),
              type: typeof params.lastquerypositiontime
            } : 'No timestamp parameter'
          });
        }
      }
      
      const response = await fetch(url.toString(), requestOptions);
      
      const contentType = response.headers.get('Content-Type') || '';
      const contentLength = response.headers.get('Content-Length') || '0';
      
      console.log(`GPS51 API Raw Response (${action}):`, {
        status: response.status,
        statusText: response.statusText,
        contentType,
        contentLength,
        url: url.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // Handle different content types
      let data: GPS51ApiResponse;
      
      if (contentType.includes('application/octet-stream') || contentType.includes('binary')) {
        console.warn(`GPS51 API: Received binary/octet-stream response for ${action}. This may indicate API parameter issues.`);
        
        // Try to read as text first
        const responseText = await response.text();
        console.log(`GPS51 API Binary Response Details:`, {
          action,
          contentLength,
          bodyLength: responseText.length,
          isEmpty: responseText.length === 0,
          firstChars: responseText.substring(0, 100)
        });
        
        if (responseText.length === 0) {
          // Empty response - return empty data structure
          data = {
            status: 1,
            message: 'Empty response received',
            data: [],
            records: []
          };
        } else {
          // Try to parse as JSON despite content-type
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.warn('GPS51 API: Binary response is not valid JSON');
            data = {
              status: 0,
              message: 'Binary response received, cannot parse as JSON',
              data: responseText
            };
          }
        }
      } else {
        // Standard JSON response handling
        const responseText = await response.text();
        console.log(`GPS51 API Response Body (${action}):`, {
          bodyLength: responseText.length,
          isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('['),
          isEmpty: responseText.length === 0,
          preview: responseText.substring(0, 200)
        });
        
        try {
          data = JSON.parse(responseText);
          console.log(`GPS51 API Parsed Response (${action}):`, {
            status: data.status,
            message: data.message,
            cause: data.cause,
            hasToken: !!data.token,
            hasUser: !!data.user,
            hasData: !!data.data,
            hasGroups: !!data.groups,
            hasRecords: !!data.records,
            dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
            dataLength: Array.isArray(data.data) ? data.data.length : undefined,
            groupsLength: Array.isArray(data.groups) ? data.groups.length : undefined,
            recordsLength: Array.isArray(data.records) ? data.records.length : undefined
          });
        } catch (parseError) {
          console.warn('GPS51 API: Non-JSON response received:', responseText);
          data = {
            status: 0,
            message: responseText || 'Empty response',
            data: responseText
          };
        }
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
      await logApiCall(action, params, response.status, data, duration);

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, {
        error: error.message,
        url: url.toString(),
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
