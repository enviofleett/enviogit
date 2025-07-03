import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';
import { GPS51Utils } from './GPS51Utils';
import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51ApiClient } from './GPS51ApiClient';

export interface DiagnosticResult {
  test: string;
  success: boolean;
  details: any;
  error?: string;
  suggestions?: string[];
}

export interface ComprehensiveDiagnostic {
  timestamp: string;
  credentials: {
    username: string;
    hasPassword: boolean;
    passwordFormat: string;
    apiUrl: string;
    from: string;
    type: string;
  };
  results: DiagnosticResult[];
  summary: {
    successfulConfigurations: number;
    totalConfigurations: number;
    recommendedConfig?: {
      endpoint: string;
      method: string;
      parameters: any;
    };
  };
}

export class GPS51AuthDiagnostics {
  private proxyClient = GPS51ProxyClient.getInstance();
  private apiClient = new GPS51ApiClient();

  async runComprehensiveDiagnostic(credentials: GPS51Credentials): Promise<ComprehensiveDiagnostic> {
    console.log('GPS51AuthDiagnostics: Starting comprehensive authentication diagnostic');
    
    const results: DiagnosticResult[] = [];
    const timestamp = new Date().toISOString();
    
    // Validate credentials format
    const credentialValidation = this.validateCredentialsFormat(credentials);
    results.push(credentialValidation);

    // Test endpoint variations
    const endpointVariations = this.getEndpointVariations(credentials.apiUrl);
    const parameterFormats = this.getParameterFormats(credentials);

    let successfulConfigurations = 0;
    let recommendedConfig: any = null;

    // Test each combination of endpoint and parameters
    for (const endpoint of endpointVariations) {
      for (const paramFormat of parameterFormats) {
        const testCredentials = { ...credentials, apiUrl: endpoint.url };
        
        // Test proxy method
        const proxyResult = await this.testProxyAuthentication(testCredentials, paramFormat);
        results.push({
          test: `Proxy Authentication - ${endpoint.type} endpoint with ${paramFormat.name} parameters`,
          success: proxyResult.success,
          details: {
            endpoint: endpoint.url,
            parameters: paramFormat.params,
            response: proxyResult.response
          },
          error: proxyResult.error,
          suggestions: proxyResult.suggestions
        });

        if (proxyResult.success && proxyResult.hasToken) {
          successfulConfigurations++;
          if (!recommendedConfig) {
            recommendedConfig = {
              endpoint: endpoint.url,
              method: 'proxy',
              parameters: paramFormat.params
            };
          }
        }

        // Test direct method
        const directResult = await this.testDirectAuthentication(testCredentials, paramFormat);
        results.push({
          test: `Direct Authentication - ${endpoint.type} endpoint with ${paramFormat.name} parameters`,
          success: directResult.success,
          details: {
            endpoint: endpoint.url,
            parameters: paramFormat.params,
            response: directResult.response
          },
          error: directResult.error,
          suggestions: directResult.suggestions
        });

        if (directResult.success && directResult.hasToken) {
          successfulConfigurations++;
          if (!recommendedConfig) {
            recommendedConfig = {
              endpoint: endpoint.url,
              method: 'direct',
              parameters: paramFormat.params
            };
          }
        }
      }
    }

    const totalConfigurations = endpointVariations.length * parameterFormats.length * 2; // 2 methods

    console.log('GPS51AuthDiagnostics: Comprehensive diagnostic completed', {
      totalTests: results.length,
      successfulConfigurations,
      totalConfigurations,
      hasRecommendedConfig: !!recommendedConfig
    });

    return {
      timestamp,
      credentials: {
        username: credentials.username,
        hasPassword: !!credentials.password,
        passwordFormat: GPS51Utils.validateMD5Hash(credentials.password) ? 'MD5' : 'Plain Text',
        apiUrl: credentials.apiUrl,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      },
      results,
      summary: {
        successfulConfigurations,
        totalConfigurations,
        recommendedConfig
      }
    };
  }

  private validateCredentialsFormat(credentials: GPS51Credentials): DiagnosticResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!credentials.username) {
      errors.push('Username is missing');
      suggestions.push('Provide a valid GPS51 username');
    }

    if (!credentials.password) {
      errors.push('Password is missing');
      suggestions.push('Provide a valid GPS51 password');
    } else if (!GPS51Utils.validateMD5Hash(credentials.password)) {
      errors.push('Password is not MD5 hashed');
      suggestions.push('Password should be MD5 hashed (32 character lowercase hex string)');
    }

    if (!credentials.apiUrl) {
      errors.push('API URL is missing');
      suggestions.push('Provide a valid GPS51 API URL');
    } else {
      try {
        new URL(credentials.apiUrl);
      } catch {
        errors.push('API URL is invalid');
        suggestions.push('Ensure API URL is properly formatted (e.g., https://api.gps51.com/openapi)');
      }
    }

    return {
      test: 'Credentials Format Validation',
      success: errors.length === 0,
      details: {
        username: credentials.username,
        passwordLength: credentials.password?.length || 0,
        passwordIsValidMD5: GPS51Utils.validateMD5Hash(credentials.password || ''),
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type
      },
      error: errors.join('; '),
      suggestions
    };
  }

  private getEndpointVariations(apiUrl: string): Array<{ type: string; url: string }> {
    const variations: Array<{ type: string; url: string }> = [];
    
    // Primary: OpenAPI endpoint as source of truth
    variations.push({ type: 'openapi_primary', url: 'https://api.gps51.com/openapi' });
    
    // Secondary: Original URL if different from primary
    if (apiUrl !== 'https://api.gps51.com/openapi') {
      variations.push({ type: 'original_url', url: apiUrl });
    }
    
    // Fallback: WebAPI endpoint (legacy compatibility)
    if (apiUrl.includes('/openapi')) {
      variations.push({ 
        type: 'webapi_fallback', 
        url: apiUrl.replace('/openapi', '/webapi') 
      });
    } else if (!apiUrl.includes('/webapi')) {
      variations.push({ 
        type: 'webapi_fallback', 
        url: apiUrl.replace(/\/$/, '') + '/webapi' 
      });
    }
    
    return variations;
  }

  private getParameterFormats(credentials: GPS51Credentials): Array<{ name: string; params: any }> {
    return [
      {
        name: 'openapi_json',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: credentials.from || 'WEB',
          type: credentials.type || 'USER'
        }
      },
      {
        name: 'openapi_minimal',
        params: {
          username: credentials.username,
          password: credentials.password
        }
      },
      {
        name: 'legacy_standard',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: credentials.from || 'WEB',
          type: credentials.type || 'USER'
        }
      },
      {
        name: 'android_compatible',
        params: {
          username: credentials.username,
          password: credentials.password,
          from: 'ANDROID',
          type: 'USER'
        }
      }
    ];
  }

  private async testProxyAuthentication(
    credentials: GPS51Credentials, 
    paramFormat: { name: string; params: any }
  ): Promise<{ success: boolean; hasToken: boolean; response: any; error?: string; suggestions?: string[] }> {
    try {
      const authToken = this.generateTestToken(credentials.username, credentials.password);
      
      const response = await this.proxyClient.makeRequest(
        'login',
        authToken,
        paramFormat.params,
        'POST',
        credentials.apiUrl
      );

      const hasToken = !!(response && response.token);
      const success = response && response.status === 0 && hasToken;

      return {
        success,
        hasToken,
        response: {
          status: response?.status,
          hasToken,
          hasUser: !!(response && response.user),
          message: response?.message
        },
        suggestions: success ? [] : this.generateSuggestions(response, 'proxy')
      };
    } catch (error) {
      return {
        success: false,
        hasToken: false,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: this.generateSuggestions(null, 'proxy', error)
      };
    }
  }

  private async testDirectAuthentication(
    credentials: GPS51Credentials, 
    paramFormat: { name: string; params: any }
  ): Promise<{ success: boolean; hasToken: boolean; response: any; error?: string; suggestions?: string[] }> {
    try {
      this.apiClient.setBaseURL(credentials.apiUrl);
      const authToken = this.generateTestToken(credentials.username, credentials.password);
      
      const response = await this.apiClient.makeRequest(
        'login',
        authToken,
        paramFormat.params,
        'POST'
      );

      const hasToken = !!(response && response.token);
      const success = response && response.status === 0 && hasToken;

      return {
        success,
        hasToken,
        response: {
          status: response?.status,
          hasToken,
          hasUser: !!(response && response.user),
          message: response?.message
        },
        suggestions: success ? [] : this.generateSuggestions(response, 'direct')
      };
    } catch (error) {
      return {
        success: false,
        hasToken: false,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestions: this.generateSuggestions(null, 'direct', error)
      };
    }
  }

  private generateTestToken(username: string, password: string): string {
    const timestamp = Date.now().toString();
    const tokenString = `${username}-${password}-${timestamp}`;
    return btoa(tokenString).substring(0, 32);
  }

  private generateSuggestions(response: any, method: string, error?: any): string[] {
    const suggestions: string[] = [];

    if (error) {
      if (error.message?.includes('fetch')) {
        suggestions.push('Network connectivity issue - check internet connection');
        suggestions.push('GPS51 API server may be down');
      } else if (error.message?.includes('CORS')) {
        suggestions.push('CORS policy blocking direct API access');
        suggestions.push('Use proxy method instead of direct method');
      }
    } else if (response) {
      if (response.status === 0 && !response.token) {
        suggestions.push('GPS51 API is responding but not returning authentication tokens');
        suggestions.push('Check parameter format compatibility with your GPS51 server version');
        suggestions.push('Verify account permissions and server configuration');
      } else if (response.status !== 0) {
        suggestions.push(`GPS51 API returned error status: ${response.status}`);
        if (response.message) {
          suggestions.push(`Error message: ${response.message}`);
        }
      }
    }

    if (method === 'proxy') {
      suggestions.push('Ensure Supabase Edge Function is deployed and configured');
    } else {
      suggestions.push('Try proxy method if direct method fails');
    }

    return suggestions;
  }

  // Export diagnostic report as formatted text
  formatDiagnosticReport(diagnostic: ComprehensiveDiagnostic): string {
    let report = `GPS51 Authentication Diagnostic Report\n`;
    report += `Generated: ${diagnostic.timestamp}\n\n`;
    
    report += `Credentials Summary:\n`;
    report += `- Username: ${diagnostic.credentials.username}\n`;
    report += `- Password Format: ${diagnostic.credentials.passwordFormat}\n`;
    report += `- API URL: ${diagnostic.credentials.apiUrl}\n`;
    report += `- From: ${diagnostic.credentials.from}\n`;
    report += `- Type: ${diagnostic.credentials.type}\n\n`;
    
    report += `Test Results Summary:\n`;
    report += `- Successful Configurations: ${diagnostic.summary.successfulConfigurations} / ${diagnostic.summary.totalConfigurations}\n`;
    
    if (diagnostic.summary.recommendedConfig) {
      report += `- Recommended Configuration:\n`;
      report += `  * Endpoint: ${diagnostic.summary.recommendedConfig.endpoint}\n`;
      report += `  * Method: ${diagnostic.summary.recommendedConfig.method}\n`;
      report += `  * Parameters: ${JSON.stringify(diagnostic.summary.recommendedConfig.parameters, null, 2)}\n`;
    } else {
      report += `- No successful configurations found\n`;
    }
    
    report += `\nDetailed Test Results:\n`;
    diagnostic.results.forEach((result, index) => {
      report += `\n${index + 1}. ${result.test}\n`;
      report += `   Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
      if (result.error) {
        report += `   Error: ${result.error}\n`;
      }
      if (result.suggestions && result.suggestions.length > 0) {
        report += `   Suggestions:\n`;
        result.suggestions.forEach(suggestion => {
          report += `   - ${suggestion}\n`;
        });
      }
    });
    
    return report;
  }
}

export const gps51AuthDiagnostics = new GPS51AuthDiagnostics();