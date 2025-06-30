
import { GPS51LoginParams, GPS51LoginValidator } from './GPS51LoginValidator';
import { GPS51LoginRequest, GPS51LoginResponse } from './GPS51LoginRequest';
import { GPS51LoginProcessor, GPS51LoginResult } from './GPS51LoginProcessor';
import { analyzeGPS51Response, quickLogGPS51Response } from './GPS51ResponseAnalyzer';

/**
 * GPS51 Login Service
 * Main service for handling GPS51 authentication
 */
export class GPS51LoginService {
  /**
   * Main login function for GPS51 API
   * @param params - Login parameters including username, password, from, and type
   * @returns Promise resolving to login result
   */
  public static async login(params: GPS51LoginParams): Promise<GPS51LoginResult> {
    try {
      console.log('GPS51LoginService: Starting login process for user:', params.username);
      
      // Step 1: Validate input parameters
      GPS51LoginValidator.validateParams(params);
      console.log('GPS51LoginService: Parameters validated successfully');
      
      // Step 2: Construct API request URL and body (with MD5 password hashing)
      const { apiUrl, requestBody } = GPS51LoginRequest.constructRequest(params);
      console.log('GPS51LoginService: Request constructed successfully for POST with JSON body');
      
      // Step 3: Make HTTP POST request to GPS51 API
      const response = await GPS51LoginRequest.makeApiRequest(apiUrl, requestBody);
      console.log('GPS51LoginService: API request completed successfully');
      
      // Step 4: Analyze response using the response analyzer
      quickLogGPS51Response(response, 'login-service');
      const analysis = analyzeGPS51Response(response, 'login-service-processing');
      
      console.log('GPS51LoginService: Response analysis completed:', {
        isSuccess: analysis.status.isSuccess,
        hasToken: analysis.token.found,
        tokenValid: analysis.token.isValid,
        statusValue: analysis.status.value,
        causeValue: analysis.cause.value
      });
      
      // Step 5: Process response and return result
      const result = GPS51LoginProcessor.processResponse(response);
      console.log('GPS51LoginService: Login process completed:', {
        success: result.success,
        hasToken: !!result.token,
        tokenLength: result.token?.length || 0,
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
