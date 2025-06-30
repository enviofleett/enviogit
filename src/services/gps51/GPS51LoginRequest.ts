
import { GPS51LoginParams } from './GPS51LoginValidator';
import { GPS51PasswordUtils } from './GPS51PasswordUtils';

/**
 * GPS51 Login Response Interface
 */
export interface GPS51LoginResponse {
  status: number;
  message?: string;
  cause?: string;
  token?: string;
  user?: {
    username: string;
    usertype: string;
    companyname?: string;
  };
}

/**
 * GPS51 Login Request Builder and API Client
 * Handles request construction and HTTP communication
 */
export class GPS51LoginRequest {
  private static readonly BASE_URL = 'https://api.gps51.com/openapi';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Constructs the API request URL and body
   * @param params - Login parameters
   * @returns Object containing URL and request body
   */
  static constructRequest(params: GPS51LoginParams) {
    // Hash the password using MD5
    const hashedPassword = GPS51PasswordUtils.hashPassword(params.plainPassword);
    
    // Construct API URL with action parameter
    const apiUrl = `${this.BASE_URL}?action=login`;
    
    // Construct request body
    const requestBody = {
      username: params.username.trim(),
      password: hashedPassword,
      from: params.from.trim().toUpperCase(),
      type: params.type.trim().toUpperCase()
    };
    
    console.log('GPS51LoginRequest: Request construction:', {
      url: apiUrl,
      bodyKeys: Object.keys(requestBody),
      username: requestBody.username,
      passwordHashed: true,
      from: requestBody.from,
      type: requestBody.type
    });
    
    return { apiUrl, requestBody };
  }

  /**
   * Makes HTTP POST request to GPS51 API
   * @param apiUrl - The API endpoint URL
   * @param requestBody - The request payload
   * @returns Promise resolving to API response
   */
  static async makeApiRequest(apiUrl: string, requestBody: any): Promise<GPS51LoginResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
    
    try {
      console.log('GPS51LoginRequest: Making API request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GPS51-WebClient/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('GPS51LoginRequest: API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const jsonResponse = await response.json();
      return jsonResponse as GPS51LoginResponse;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.REQUEST_TIMEOUT}ms`);
      }
      
      console.error('GPS51LoginRequest: API request failed:', {
        error: error.message,
        stack: error.stack
      });
      
      throw new Error(`Network request failed: ${error.message}`);
    }
  }
}
