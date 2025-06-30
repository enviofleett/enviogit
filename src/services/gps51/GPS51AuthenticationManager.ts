
import { GPS51AuthCredentials, GPS51User } from './GPS51Types';
import { GPS51_STATUS } from './GPS51Constants';
import { GPS51Utils } from './GPS51Utils';
import { GPS51ApiClient } from './GPS51ApiClient';
import { analyzeGPS51Response, quickLogGPS51Response } from './GPS51ResponseAnalyzer';

export interface GPS51AuthResult {
  success: boolean;
  user?: GPS51User;
  error?: string;
  token?: string;
}

export class GPS51AuthenticationManager {
  private apiClient: GPS51ApiClient;

  constructor(apiClient: GPS51ApiClient) {
    this.apiClient = apiClient;
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<GPS51AuthResult> {
    try {
      console.log('GPS51 Authentication Debug Info:', { 
        username: credentials.username,
        passwordProvided: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        isPasswordMD5: GPS51Utils.validateMD5Hash(credentials.password || ''),
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type 
      });

      // Validate that password is MD5 hash format
      if (!GPS51Utils.validateMD5Hash(credentials.password)) {
        console.warn('Password does not appear to be a valid MD5 hash. Expected 32 lowercase hex characters.');
        console.log('Password validation details:', GPS51Utils.getPasswordValidationInfo(credentials.password));
      }

      if (credentials.apiUrl) {
        const normalizedUrl = GPS51Utils.normalizeApiUrl(credentials.apiUrl);
        this.apiClient.setBaseURL(normalizedUrl);
      }

      const loginParams = {
        username: credentials.username,
        password: credentials.password,
        from: credentials.from,
        type: credentials.type
      };

      console.log('Sending GPS51 login request with parameters:', {
        method: 'POST',
        loginParams: {
          ...loginParams,
          password: 'hashed'
        },
        parameterValidation: {
          usernameLength: loginParams.username.length,
          passwordIsMD5: GPS51Utils.validateMD5Hash(loginParams.password),
          fromValue: loginParams.from,
          typeValue: loginParams.type,
          allRequiredPresent: !!(loginParams.username && loginParams.password && loginParams.from && loginParams.type)
        }
      });

      // For login, we don't have a token yet, so we pass empty string
      // The login action will return the token we need for subsequent calls
      const response = await this.apiClient.makeRequest('login', '', loginParams, 'POST');

      // Use response analyzer for comprehensive analysis
      quickLogGPS51Response(response, 'authentication');
      const analysis = analyzeGPS51Response(response, 'authentication');

      console.log('GPS51 Authentication Analysis Complete:', {
        isSuccess: analysis.status.isSuccess,
        statusValue: analysis.status.value,
        hasToken: analysis.token.found,
        tokenValid: analysis.token.isValid,
        tokenLength: analysis.token.length,
        hasUser: analysis.user.found,
        cause: analysis.cause.value
      });

      if (analysis.status.isSuccess && analysis.token.isValid) {
        console.log('GPS51 Authentication successful:', {
          token: analysis.token.value ? 'Present (length: ' + analysis.token.value.length + ')' : 'Missing',
          user: analysis.user.value
        });

        return {
          success: true,
          user: analysis.user.value || undefined,
          token: analysis.token.value || undefined
        };
      } else {
        console.error('GPS51 Authentication failed - detailed analysis:', {
          statusFound: analysis.status.found,
          statusValue: analysis.status.value,
          statusIsSuccess: analysis.status.isSuccess,
          tokenFound: analysis.token.found,
          tokenValid: analysis.token.isValid,
          causeValue: analysis.cause.value,
          messageValue: analysis.message.value
        });
        
        let errorMessage = analysis.cause.value || `Authentication failed with status: ${analysis.status.value}`;
        
        if (analysis.status.value === 8901) {
          errorMessage += ' (Status 8901: Authentication parameter validation failed - check username, password hash, from, and type parameters)';
        } else if (analysis.status.value === 1) {
          errorMessage += ' (Status 1: Login failed - verify credentials and account status)';
        } else if (analysis.status.value === 8903) {
          errorMessage += ' (Status 8903: Account locked due to too many failed attempts)';
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('GPS51 Authentication exception:', {
        error: error.message,
        stack: error.stack,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          apiUrl: credentials.apiUrl,
          from: credentials.from,
          type: credentials.type
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }
}
