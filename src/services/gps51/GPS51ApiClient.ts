
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
    try {
      console.log(`GPS51 API Request: ${action}`, { 
        baseURL: this.baseURL,
        method,
        hasToken: !!token,
        tokenLength: token?.length || 0,
        paramsKeys: Object.keys(params)
      });
      
      const requestOptions: RequestInit = {
        method: 'POST', // GPS51 API uses POST for all requests
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      };

      // Construct JSON body with action, token, and parameters
      const requestBody = {
        action: action,
        token: token,
        ...params
      };

      requestOptions.body = JSON.stringify(requestBody);
      
      console.log('GPS51 POST Request Details:', {
        url: this.baseURL,
        method: 'POST',
        headers: requestOptions.headers,
        bodyKeys: Object.keys(requestBody),
        action: requestBody.action,
        hasToken: !!requestBody.token,
        tokenPreview: requestBody.token ? requestBody.token.substring(0, 8) + '...' : 'none'
      });
      
      const response = await fetch(this.baseURL, requestOptions);
      
      const responseText = await response.text();
      console.log(`GPS51 API Raw Response (${action}):`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        contentLength: response.headers.get('Content-Length'),
        rawBodyLength: responseText.length,
        rawBodyPreview: responseText.substring(0, 200),
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
        url: this.baseURL,
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
