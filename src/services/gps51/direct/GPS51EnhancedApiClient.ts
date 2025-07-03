import { GPS51ApiResponse } from '../GPS51Types';
import { GPS51_DEFAULTS } from '../GPS51Constants';
import { GPS51Utils } from '../GPS51Utils';

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
}

export interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  retryCount: number;
  success: boolean;
  error?: string;
}

export class GPS51EnhancedApiClient {
  private baseURL: string;
  private defaultOptions: Required<RequestOptions>;
  private requestQueue: Map<string, AbortController> = new Map();
  private metrics: RequestMetrics[] = [];
  private maxMetricsHistory = 100;

  constructor(baseURL: string = GPS51_DEFAULTS.BASE_URL) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {},
      priority: 'normal'
    };
  }

  setBaseURL(url: string): void {
    this.baseURL = GPS51Utils.normalizeApiUrl(url);
    console.log('GPS51EnhancedApiClient: Base URL updated:', this.baseURL);
  }

  async makeAuthenticatedRequest(
    action: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'POST',
    token?: string,
    options: RequestOptions = {}
  ): Promise<GPS51ApiResponse> {
    const requestId = this.generateRequestId(action);
    const mergedOptions = { ...this.defaultOptions, ...options };
    const metrics = this.createMetrics();

    try {
      console.log(`GPS51EnhancedApiClient: Starting ${action} request`, {
        requestId,
        method,
        params,
        options: mergedOptions
      });

      // Create abort controller for this request
      const abortController = new AbortController();
      this.requestQueue.set(requestId, abortController);

      // Set timeout
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, mergedOptions.timeout);

      let lastError: Error | null = null;

      // Retry loop
      for (let attempt = 0; attempt <= mergedOptions.retries; attempt++) {
        try {
          metrics.retryCount = attempt;

          if (attempt > 0) {
            console.log(`GPS51EnhancedApiClient: Retry attempt ${attempt}/${mergedOptions.retries} for ${action}`);
            await this.delay(mergedOptions.retryDelay * Math.pow(2, attempt - 1));
          }

          const result = await this.executeRequest(
            action,
            params,
            method,
            token,
            mergedOptions,
            abortController.signal
          );

          // Success - clean up and return
          clearTimeout(timeoutId);
          this.requestQueue.delete(requestId);
          
          metrics.success = true;
          metrics.endTime = Date.now();
          metrics.duration = metrics.endTime - metrics.startTime;
          this.addMetrics(metrics);

          console.log(`GPS51EnhancedApiClient: ${action} request successful`, {
            requestId,
            duration: metrics.duration,
            retryCount: metrics.retryCount
          });

          return result;

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          console.warn(`GPS51EnhancedApiClient: ${action} attempt ${attempt + 1} failed:`, {
            requestId,
            error: lastError.message,
            willRetry: attempt < mergedOptions.retries
          });

          // Don't retry on authentication errors
          if (this.isNonRetryableError(lastError)) {
            break;
          }
        }
      }

      // All retries failed
      clearTimeout(timeoutId);
      this.requestQueue.delete(requestId);
      
      metrics.success = false;
      metrics.error = lastError?.message || 'Unknown error';
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      this.addMetrics(metrics);

      throw lastError || new Error('Request failed after all retries');

    } catch (error) {
      // Clean up on any error
      this.requestQueue.delete(requestId);
      
      if (!metrics.endTime) {
        metrics.success = false;
        metrics.error = error instanceof Error ? error.message : 'Unknown error';
        metrics.endTime = Date.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        this.addMetrics(metrics);
      }

      throw error;
    }
  }

  private async executeRequest(
    action: string,
    params: Record<string, any>,
    method: 'GET' | 'POST',
    token: string | undefined,
    options: Required<RequestOptions>,
    signal: AbortSignal
  ): Promise<GPS51ApiResponse> {
    // Build URL
    const url = new URL(this.baseURL);
    url.searchParams.append('action', action);
    
    if (token) {
      url.searchParams.append('token', token);
    } else {
      // For login requests, generate a temporary token
      url.searchParams.append('token', GPS51Utils.generateToken());
    }

    // Add undocumented parameters for specific actions
    if (action === 'lastposition') {
      url.searchParams.append('streamtype', 'proto');
      url.searchParams.append('send', '2');
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GPS51-Direct-Client/1.0',
        ...options.headers
      }
    };

    // Add body for POST requests - GPS51 API expects form-encoded data
    if (method === 'POST' && Object.keys(params).length > 0) {
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      
      // Convert params to form-encoded format
      const formParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          formParams.append(key, value.join(','));
        } else {
          formParams.append(key, String(value));
        }
      });
      requestOptions.body = formParams.toString();
    }

    console.log('GPS51EnhancedApiClient: Executing request:', {
      url: url.toString(),
      method,
      headers: requestOptions.headers,
      bodyParams: method === 'POST' ? params : undefined
    });

    // Execute request
    const response = await fetch(url.toString(), requestOptions);
    const responseText = await response.text();

    console.log('GPS51EnhancedApiClient: Raw response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('Content-Type'),
      bodyLength: responseText.length,
      isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
    }

    // Parse response
    let data: GPS51ApiResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('GPS51EnhancedApiClient: Non-JSON response received:', responseText);
      data = {
        status: 0,
        message: responseText,
        data: responseText
      };
    }

    return data;
  }

  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('authentication') ||
           message.includes('unauthorized') ||
           message.includes('forbidden') ||
           message.includes('400') ||
           message.includes('401') ||
           message.includes('403');
  }

  private generateRequestId(action: string): string {
    return `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createMetrics(): RequestMetrics {
    return {
      startTime: Date.now(),
      retryCount: 0,
      success: false
    };
  }

  private addMetrics(metrics: RequestMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Request management
  cancelRequest(requestId: string): boolean {
    const controller = this.requestQueue.get(requestId);
    if (controller) {
      controller.abort();
      this.requestQueue.delete(requestId);
      return true;
    }
    return false;
  }

  cancelAllRequests(): number {
    const count = this.requestQueue.size;
    this.requestQueue.forEach(controller => controller.abort());
    this.requestQueue.clear();
    return count;
  }

  // Metrics and monitoring
  getMetrics(): {
    averageResponseTime: number;
    successRate: number;
    totalRequests: number;
    activeRequests: number;
    recentErrors: string[];
  } {
    const recentMetrics = this.metrics.slice(-20); // Last 20 requests
    const successfulRequests = recentMetrics.filter(m => m.success);
    const averageResponseTime = successfulRequests.length > 0 
      ? successfulRequests.reduce((sum, m) => sum + (m.duration || 0), 0) / successfulRequests.length
      : 0;
    
    const successRate = recentMetrics.length > 0 
      ? (successfulRequests.length / recentMetrics.length) * 100
      : 0;

    const recentErrors = recentMetrics
      .filter(m => !m.success && m.error)
      .slice(-5)
      .map(m => m.error!);

    return {
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round(successRate * 100) / 100,
      totalRequests: this.metrics.length,
      activeRequests: this.requestQueue.size,
      recentErrors
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(this.baseURL, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: response.ok,
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }
}
