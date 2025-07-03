
import { GPS51ApiResponse } from './GPS51Types';
import { GPS51_DEFAULTS } from './GPS51Constants';

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
    // Build URL with action and token as query parameters
    const url = new URL(this.baseURL);
    url.searchParams.append('action', action);
    url.searchParams.append('token', token);
    
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

      // For POST requests, send parameters in JSON body
      if (method === 'POST' && Object.keys(params).length > 0) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
        requestOptions.body = JSON.stringify(params);
        
        console.log('GPS51 POST Request Details:', {
          url: url.toString(),
          method: 'POST',
          headers: requestOptions.headers,
          body: requestOptions.body,
          bodyObject: params
        });
      }
      
      const response = await fetch(url.toString(), requestOptions);
      
      const responseText = await response.text();
      console.log(`GPS51 API Raw Response (${action}):`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        contentLength: response.headers.get('Content-Length'),
        rawBody: responseText,
        bodyLength: responseText.length,
        isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
      }

      let data: GPS51ApiResponse;
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
        console.warn('Non-JSON response received:', responseText);
        data = {
          status: 0,
          message: responseText,
          data: responseText
        };
      }

      this.retryCount = 0;
      this.retryDelay = GPS51_DEFAULTS.RETRY_DELAY;

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, {
        error: error.message,
        url: url.toString(),
        params,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Retrying GPS51 request (${this.retryCount}/${this.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(action, token, params, method);
      }

      throw error;
    }
  }

  resetRetryState(): void {
    this.retryCount = 0;
    this.retryDelay = GPS51_DEFAULTS.RETRY_DELAY;
  }
}
