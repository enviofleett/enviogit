import { GPS51ApiClient } from './GPS51ApiClient';

export interface NetworkConnectivityResult {
  isReachable: boolean;
  responseTime: number;
  statusCode?: number;
  contentType?: string;
  errorType?: 'CORS' | 'NETWORK' | 'SSL' | 'TIMEOUT' | 'UNKNOWN';
  errorMessage?: string;
  recommendedAction?: string;
}

export interface GPS51ApiTestResult {
  connectivity: NetworkConnectivityResult;
  apiResponse?: any;
  authenticationPossible: boolean;
  diagnostics: {
    headRequestWorks: boolean;
    getRequestWorks: boolean;
    postRequestWorks: boolean;
    corsEnabled: boolean;
    sslValid: boolean;
  };
}

export class GPS51NetworkConnectivityService {
  private baseURL: string;
  private apiClient: GPS51ApiClient;

  constructor(baseURL: string = 'https://api.gps51.com/openapi') {
    this.baseURL = baseURL;
    this.apiClient = new GPS51ApiClient();
    this.apiClient.setBaseURL(baseURL);
  }

  async testNetworkConnectivity(): Promise<NetworkConnectivityResult> {
    const startTime = Date.now();
    
    try {
      console.log('GPS51NetworkConnectivity: Testing basic connectivity to:', this.baseURL);
      
      // Test 1: Basic HEAD request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(this.baseURL, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      console.log('GPS51NetworkConnectivity: Head request result:', {
        status: response.status,
        statusText: response.statusText,
        responseTime,
        headers: Object.fromEntries(response.headers.entries())
      });

      return {
        isReachable: true,
        responseTime,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      console.error('GPS51NetworkConnectivity: Connectivity test failed:', error);
      
      // Classify error types
      let errorType: NetworkConnectivityResult['errorType'] = 'UNKNOWN';
      let recommendedAction = '';
      
      if (error.name === 'AbortError') {
        errorType = 'TIMEOUT';
        recommendedAction = 'Check network connection and try again';
      } else if (error.message.includes('CORS')) {
        errorType = 'CORS';
        recommendedAction = 'Use Edge Function proxy to bypass CORS';
      } else if (error.message.includes('fetch')) {
        errorType = 'NETWORK';
        recommendedAction = 'Check internet connection or firewall settings';
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        errorType = 'SSL';
        recommendedAction = 'SSL certificate issue - contact GPS51 support';
      }

      return {
        isReachable: false,
        responseTime,
        errorType,
        errorMessage: error.message,
        recommendedAction
      };
    }
  }

  async testGPS51APIAccessibility(): Promise<GPS51ApiTestResult> {
    console.log('GPS51NetworkConnectivity: Running comprehensive API accessibility test...');
    
    const connectivity = await this.testNetworkConnectivity();
    
    const diagnostics = {
      headRequestWorks: connectivity.isReachable,
      getRequestWorks: false,
      postRequestWorks: false,
      corsEnabled: false,
      sslValid: connectivity.errorType !== 'SSL'
    };

    // Test GET request
    try {
      const testUrl = new URL(this.baseURL);
      testUrl.searchParams.append('action', 'login');
      testUrl.searchParams.append('token', 'test');
      
      const getResponse = await fetch(testUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      diagnostics.getRequestWorks = true;
      diagnostics.corsEnabled = true;
      
      console.log('GPS51NetworkConnectivity: GET request test passed');
    } catch (error) {
      console.log('GPS51NetworkConnectivity: GET request test failed:', error);
    }

    // Test POST request
    try {
      const postResponse = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: 'action=login&token=test&username=test&password=test'
      });
      
      diagnostics.postRequestWorks = true;
      
      const responseText = await postResponse.text();
      console.log('GPS51NetworkConnectivity: POST request test result:', {
        status: postResponse.status,
        contentType: postResponse.headers.get('content-type'),
        bodyPreview: responseText.substring(0, 200)
      });
      
    } catch (error) {
      console.log('GPS51NetworkConnectivity: POST request test failed:', error);
    }

    const authenticationPossible = diagnostics.getRequestWorks || diagnostics.postRequestWorks;

    return {
      connectivity,
      authenticationPossible,
      diagnostics
    };
  }

  async diagnoseConnectivityIssues(): Promise<{
    issues: string[];
    recommendations: string[];
    canProceed: boolean;
    suggestEdgeFunction: boolean;
  }> {
    const testResult = await this.testGPS51APIAccessibility();
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!testResult.connectivity.isReachable) {
      issues.push(`Cannot reach GPS51 API: ${testResult.connectivity.errorMessage}`);
      recommendations.push(testResult.connectivity.recommendedAction || 'Check network connectivity');
    }
    
    if (!testResult.diagnostics.corsEnabled) {
      issues.push('CORS policy prevents direct browser access to GPS51 API');
      recommendations.push('Use Supabase Edge Function as a proxy to bypass CORS restrictions');
    }
    
    if (!testResult.diagnostics.sslValid) {
      issues.push('SSL certificate validation failed');
      recommendations.push('Contact GPS51 support about SSL certificate issues');
    }
    
    if (!testResult.diagnostics.postRequestWorks) {
      issues.push('POST requests to GPS51 API are failing');
      recommendations.push('Check firewall and network policies');
    }

    const canProceed = testResult.authenticationPossible && testResult.diagnostics.sslValid;
    const suggestEdgeFunction = !testResult.diagnostics.corsEnabled || issues.length > 1;

    return {
      issues,
      recommendations,
      canProceed,
      suggestEdgeFunction
    };
  }

  // Quick connectivity check for use in components
  async quickConnectivityCheck(): Promise<boolean> {
    try {
      const result = await this.testNetworkConnectivity();
      return result.isReachable;
    } catch {
      return false;
    }
  }
}