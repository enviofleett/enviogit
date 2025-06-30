import { md5 } from 'js-md5';
import { analyzeGPS51Response, quickLogGPS51Response } from './GPS51ResponseAnalyzer';

/**
 * GPS51 Login Response Interface
 */
interface GPS51LoginResponse {
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
 * GPS51 Login Parameters Interface
 */
interface GPS51LoginParams {
  username: string;
  plainPassword: string;
  from: string; // e.g., 'WEB', 'ANDROID', 'IPHONE', 'WEIXIN'
  type: string; // e.g., 'USER', 'DEVICE'
}

/**
 * GPS51 Login Result Interface
 */
interface GPS51LoginResult {
  success: boolean;
  token?: string;
  user?: {
    username: string;
    usertype: string;
    companyname?: string;
  };
  error?: string;
  status?: number;
  cause?: string;
}

/**
 * GPS51 Login Service
 * Handles authentication with the GPS51 API using proper MD5 encryption
 */
export class GPS51LoginService {
  private static readonly BASE_URL = 'https://api.gps51.com/openapi';
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds

  /**
   * Converts plain text password to MD5 hash (32-digit lowercase string)
   * @param plainPassword - The plain text password
   * @returns MD5 hash as lowercase string
   */
  private static hashPassword(plainPassword: string): string {
    // Use js-md5 library to create MD5 hash
    const hashedPassword = md5(plainPassword).toLowerCase();
    
    console.log('GPS51LoginService: Password hashing:', {
      originalLength: plainPassword.length,
      hashedLength: hashedPassword.length,
      isValidMD5Format: /^[a-f0-9]{32}$/.test(hashedPassword),
      hashedPreview: hashedPassword.substring(0, 8) + '...'
    });
    
    return hashedPassword;
  }

  /**
   * Validates login parameters
   * @param params - Login parameters to validate
   * @throws Error if validation fails
   */
  private static validateParams(params: GPS51LoginParams): void {
    if (!params.username || params.username.trim() === '') {
      throw new Error('Username is required and cannot be empty');
    }
    
    if (!params.plainPassword || params.plainPassword.trim() === '') {
      throw new Error('Password is required and cannot be empty');
    }
    
    if (!params.from || params.from.trim() === '') {
      throw new Error('From parameter is required (e.g., WEB, ANDROID, IPHONE, WEIXIN)');
    }
    
    if (!params.type || params.type.trim() === '') {
      throw new Error('Type parameter is required (e.g., USER, DEVICE)');
    }
  }

  /**
   * Constructs the API request URL and body
   * @param params - Login parameters
   * @returns Object containing URL and request body
   */
  private static constructRequest(params: GPS51LoginParams) {
    // Hash the password using MD5
    const hashedPassword = this.hashPassword(params.plainPassword);
    
    // Construct API URL with action parameter
    const apiUrl = `${this.BASE_URL}?action=login`;
    
    // Construct request body
    const requestBody = {
      username: params.username.trim(),
      password: hashedPassword,
      from: params.from.trim().toUpperCase(),
      type: params.type.trim().toUpperCase()
    };
    
    console.log('GPS51LoginService: Request construction:', {
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
  private static async makeApiRequest(apiUrl: string, requestBody: any): Promise<GPS51LoginResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
    
    try {
      console.log('GPS51LoginService: Making API request to:', apiUrl);
      
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
      
      console.log('GPS51LoginService: API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const jsonResponse = await response.json();
      
      // Use the response analyzer for detailed logging
      quickLogGPS51Response(jsonResponse, 'login-request');
      const analysis = analyzeGPS51Response(jsonResponse, 'login');
      
      console.log('GPS51LoginService: Analysis complete:', {
        isSuccess: analysis.status.isSuccess,
        hasToken: analysis.token.isValid,
        statusValue: analysis.status.value,
        causeValue: analysis.cause.value
      });
      
      return jsonResponse as GPS51LoginResponse;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.REQUEST_TIMEOUT}ms`);
      }
      
      console.error('GPS51LoginService: API request failed:', {
        error: error.message,
        stack: error.stack
      });
      
      throw new Error(`Network request failed: ${error.message}`);
    }
  }

  /**
   * Processes the API response and determines login success/failure
   * @param response - The API response from GPS51
   * @returns Processed login result
   */
  private static processResponse(response: GPS51LoginResponse): GPS51LoginResult {
    // Use response analyzer for comprehensive analysis
    const analysis = analyzeGPS51Response(response, 'login-processing');
    
    // Check for successful login (status: 0)
    if (analysis.status.isSuccess) {
      console.log('GPS51LoginService: Login successful:', {
        hasToken: analysis.token.found,
        tokenValid: analysis.token.isValid,
        tokenLength: analysis.token.value?.length || 0,
        hasUser: analysis.user.found,
        userInfo: analysis.user.value
      });
      
      return {
        success: true,
        token: analysis.token.value || undefined,
        user: analysis.user.value || undefined,
        status: analysis.status.value || 0
      };
    }
    
    // Handle failed login
    const errorMessage = analysis.cause.value || `Login failed with status: ${analysis.status.value}`;
    
    console.log('GPS51LoginService: Login failed:', {
      status: analysis.status.value,
      cause: analysis.cause.value,
      errorMessage
    });
    
    return {
      success: false,
      error: errorMessage,
      status: analysis.status.value || -1,
      cause: analysis.cause.value || undefined
    };
  }

  /**
   * Main login function for GPS51 API
   * @param params - Login parameters including username, password, from, and type
   * @returns Promise resolving to login result
   */
  public static async login(params: GPS51LoginParams): Promise<GPS51LoginResult> {
    try {
      console.log('GPS51LoginService: Starting login process for user:', params.username);
      
      // Step 1: Validate input parameters
      this.validateParams(params);
      console.log('GPS51LoginService: Parameters validated successfully');
      
      // Step 2: Construct API request URL and body (with MD5 password hashing)
      const { apiUrl, requestBody } = this.constructRequest(params);
      console.log('GPS51LoginService: Request constructed successfully');
      
      // Step 3: Make HTTP POST request to GPS51 API
      const response = await this.makeApiRequest(apiUrl, requestBody);
      console.log('GPS51LoginService: API request completed successfully');
      
      // Step 4: Process response and return result
      const result = this.processResponse(response);
      console.log('GPS51LoginService: Login process completed:', {
        success: result.success,
        hasToken: !!result.token,
        hasError: !!result.error
      });
      
      return result;
      
    } catch (error) {
      console.error('GPS51LoginService: Login process failed:', {
        error: error.message,
        stack: error.stack,
        username: params.username
      });
      
      return {
        success: false,
        error: error.message,
        status: -1,
        cause: 'Client-side error'
      };
    }
  }

  /**
   * Convenience method for quick login with separate parameters
   * @param username - GPS51 username
   * @param plainPassword - Plain text password (will be MD5 hashed)
   * @param from - Source platform (default: 'WEB')
   * @param type - User type (default: 'USER')
   * @returns Promise resolving to login result
   */
  public static async quickLogin(
    username: string,
    plainPassword: string,
    from: string = 'WEB',
    type: string = 'USER'
  ): Promise<GPS51LoginResult> {
    return this.login({
      username,
      plainPassword,
      from,
      type
    });
  }
}

// Export the main login function for direct use
export const gps51Login = GPS51LoginService.login;
export const gps51QuickLogin = GPS51LoginService.quickLogin;

// Export types for use in other files
export type { GPS51LoginParams, GPS51LoginResult, GPS51LoginResponse };
