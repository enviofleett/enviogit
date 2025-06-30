
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
    console.log('GPS51LoginProcessor: Starting response processing...');
    
    // Use response analyzer for detailed logging and analysis
    quickLogGPS51Response(response, 'login-processor');
    const analysis = analyzeGPS51Response(response, 'login-processor-detailed');
    
    console.log('GPS51LoginProcessor: Comprehensive analysis complete:', {
      isSuccess: analysis.status.isSuccess,
      hasToken: analysis.token.found,
      tokenValid: analysis.token.isValid,
      tokenLength: analysis.token.length,
      statusValue: analysis.status.value,
      causeValue: analysis.cause.value,
      hasUser: analysis.user.found,
      userValue: analysis.user.value
    });

    // Check for successful login using analyzed data
    if (analysis.status.isSuccess && analysis.token.isValid) {
      console.log('GPS51LoginProcessor: Login successful - extracting token and user data:', {
        tokenFound: analysis.token.found,
        tokenValid: analysis.token.isValid,
        tokenLength: analysis.token.length,
        tokenPreview: analysis.token.value ? analysis.token.value.substring(0, 8) + '...' : 'none',
        hasUser: analysis.user.found,
        username: analysis.user.value?.username || 'not found'
      });
      
      return {
        success: true,
        token: analysis.token.value || undefined,
        user: analysis.user.value || undefined,
        status: analysis.status.value || 0
      };
    }
    
    // Handle failed login with detailed error information
    const errorMessage = analysis.cause.value || `Login failed with status: ${analysis.status.value}`;
    
    console.error('GPS51LoginProcessor: Login failed - detailed error analysis:', {
      status: analysis.status.value,
      statusType: analysis.status.type,
      cause: analysis.cause.value,
      causeType: analysis.cause.type,
      message: analysis.message.value,
      errorMessage,
      tokenFound: analysis.token.found,
      tokenValid: analysis.token.isValid
    });
    
    // Add specific error guidance based on status codes
    let enhancedErrorMessage = errorMessage;
    if (analysis.status.value === 8901) {
      enhancedErrorMessage += ' - Parameter validation failed. Check username, password hash format, from, and type values.';
    } else if (analysis.status.value === 1) {
      enhancedErrorMessage += ' - Invalid credentials or account issue. Verify username and password.';
    } else if (analysis.status.value === 8903) {
      enhancedErrorMessage += ' - Account temporarily locked due to multiple failed attempts.';
    }
    
    return {
      success: false,
      error: enhancedErrorMessage,
      status: analysis.status.value || -1,
      cause: analysis.cause.value || undefined
    };
  }
}
