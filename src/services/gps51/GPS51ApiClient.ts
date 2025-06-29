
import { GPS51ApiResponse } from './GPS51Client';
import { GPS51_STATUS } from './GPS51ApiEndpoints';

export class GPS51ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL;
  }

  private generateToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private validateMD5Hash(password: string): boolean {
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  async makeRequest(
    action: string, 
    params: Record<string, any> = {}, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const requestToken = this.generateToken();
    
    const url = new URL(this.baseURL);
    url.searchParams.append('action', action);
    url.searchParams.append('token', requestToken);

    try {
      console.log(`GPS51 API Request: ${action}`, { 
        url: url.toString(), 
        method,
        params,
        baseURL: this.baseURL,
        ...(action === 'login' && params.password ? {
          passwordValidation: {
            isValidMD5: this.validateMD5Hash(params.password),
            passwordLength: params.password.length,
          }
        } : {})
      });
      
      const requestOptions: RequestInit = {
        method: method,
        headers: {
          'Accept': 'application/json',
        }
      };

      if (method === 'POST' && Object.keys(params).length > 0) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
        
        // Add Authorization header if we have a token and this isn't a login request
        if (this.token && action !== 'login') {
          requestOptions.headers = {
            ...requestOptions.headers,
            'Authorization': `Bearer ${this.token}`,
          };
        }
        
        requestOptions.body = JSON.stringify(params);
        
        console.log('GPS51 POST Request Details:', {
          url: url.toString(),
          method: 'POST',
          headers: requestOptions.headers,
          bodyObject: params
        });
      }
      
      const response = await fetch(url.toString(), requestOptions);
      
      const responseText = await response.text();
      console.log(`GPS51 API Raw Response (${action}):`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
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
          hasToken: !!data.token,
          hasUser: !!data.user,
          hasData: !!data.data,
          hasGroups: !!data.groups,
          hasRecords: !!data.records,
          dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
        });
      } catch (parseError) {
        console.warn('Non-JSON response received:', responseText);
        data = {
          status: GPS51_STATUS.SUCCESS,
          message: responseText,
          data: responseText
        };
      }

      this.retryCount = 0;
      this.retryDelay = 1000;

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, {
        error: error.message,
        url: url.toString(),
        params,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      if (this.retryCount < this.maxRetries && 
          (error.message.includes('network') || error.message.includes('timeout'))) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Retrying GPS51 request (${this.retryCount}/${this.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(action, params, method);
      }

      throw error;
    }
  }
}
