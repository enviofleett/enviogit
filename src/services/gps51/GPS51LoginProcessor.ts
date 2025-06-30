
import { GPS51LoginResponse } from './GPS51LoginRequest';
import { analyzeGPS51Response, quickLogGPS51Response } from './GPS51ResponseAnalyzer';

/**
 * GPS51 Login Result Interface
 */
export interface GPS51LoginResult {
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
 * GPS51 Login Response Processor
 * Handles response analysis and result processing
 */
export class GPS51LoginProcessor {
  /**
   * Processes the API response and determines login success/failure
   * @param response - The API response from GPS51
   * @returns Processed login result
   */
  static processResponse(response: GPS51LoginResponse): GPS51LoginResult {
    // Use response analyzer for detailed logging
    quickLogGPS51Response(response, 'login-request');
    const analysis = analyzeGPS51Response(response, 'login-processing');
    
    console.log('GPS51LoginProcessor: Analysis complete:', {
      isSuccess: analysis.status.isSuccess,
      hasToken: analysis.token.isValid,
      statusValue: analysis.status.value,
      causeValue: analysis.cause.value
    });

    // Check for successful login (status: 0)
    if (analysis.status.isSuccess) {
      console.log('GPS51LoginProcessor: Login successful:', {
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
    
    console.log('GPS51LoginProcessor: Login failed:', {
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
}
