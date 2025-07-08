/**
 * GPS51 Device Diagnostics Service
 * Comprehensive device discovery and troubleshooting for "No devices found" issues
 */

import { GPS51Client } from './GPS51Client';
import { gps51CoordinatorClient } from './GPS51CoordinatorClient';
import { GPS51Device } from './types';

interface DeviceDiscoveryResult {
  success: boolean;
  devices: GPS51Device[];
  diagnostics: {
    authStatus: any;
    apiResponses: any[];
    attemptedMethods: string[];
    possibleIssues: string[];
    recommendations: string[];
  };
  fallbackDataAvailable: boolean;
}

interface GPS51AccountInfo {
  hasDevices: boolean;
  accountType: string;
  apiVariant: string;
  requiresSpecialHandling: boolean;
}

export class GPS51DeviceDiagnostics {
  private client: GPS51Client;

  constructor(client: GPS51Client) {
    this.client = client;
  }

  /**
   * Comprehensive device discovery with multiple fallback strategies
   */
  async discoverDevices(): Promise<DeviceDiscoveryResult> {
    console.log('🔍 GPS51DeviceDiagnostics: Starting comprehensive device discovery...');
    
    const diagnostics = {
      authStatus: this.getAuthenticationDiagnostics(),
      apiResponses: [],
      attemptedMethods: [],
      possibleIssues: [],
      recommendations: []
    };

    let devices: GPS51Device[] = [];
    let fallbackDataAvailable = false;

    // Method 1: Standard device list query
    try {
      diagnostics.attemptedMethods.push('Standard querymonitorlist');
      console.log('📡 Attempting standard device list query...');
      
      const standardResult = await this.attemptStandardDeviceQuery();
      diagnostics.apiResponses.push({
        method: 'querymonitorlist',
        response: standardResult,
        timestamp: new Date().toISOString()
      });

      if (standardResult.devices && standardResult.devices.length > 0) {
        devices = standardResult.devices;
        console.log(`✅ Standard query found ${devices.length} devices`);
      } else {
        console.log('⚠️ Standard query returned empty device list');
        diagnostics.possibleIssues.push('Standard API returned empty groups array');
      }
    } catch (error) {
      console.warn('❌ Standard device query failed:', error);
      diagnostics.apiResponses.push({
        method: 'querymonitorlist',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      diagnostics.possibleIssues.push(`Standard query failed: ${error.message}`);
    }

    // Method 2: Alternative API endpoints and parameters
    if (devices.length === 0) {
      const alternativeResults = await this.tryAlternativeQueries();
      diagnostics.apiResponses.push(...alternativeResults.responses);
      diagnostics.attemptedMethods.push(...alternativeResults.methods);
      
      if (alternativeResults.devices.length > 0) {
        devices = alternativeResults.devices;
        console.log(`✅ Alternative query found ${devices.length} devices`);
      }
    }

    // Method 3: Account-specific diagnostics
    const accountInfo = await this.analyzeAccount();
    diagnostics.apiResponses.push({
      method: 'account_analysis',
      response: accountInfo,
      timestamp: new Date().toISOString()
    });

    // Method 4: Emergency fallback - try coordinator directly
    if (devices.length === 0) {
      try {
        diagnostics.attemptedMethods.push('Coordinator emergency fallback');
        console.log('🚨 Trying emergency coordinator fallback...');
        
        const coordinatorDevices = await this.tryCoordinatorFallback();
        if (coordinatorDevices.length > 0) {
          devices = coordinatorDevices;
          fallbackDataAvailable = true;
          console.log(`✅ Coordinator fallback found ${devices.length} devices`);
        }
      } catch (coordinatorError) {
        console.warn('❌ Coordinator fallback failed:', coordinatorError);
        diagnostics.possibleIssues.push(`Coordinator fallback failed: ${coordinatorError.message}`);
      }
    }

    // Generate recommendations based on findings
    this.generateRecommendations(diagnostics, accountInfo);

    const result: DeviceDiscoveryResult = {
      success: devices.length > 0,
      devices,
      diagnostics,
      fallbackDataAvailable
    };

    console.log('🔍 GPS51DeviceDiagnostics: Discovery complete:', {
      devicesFound: devices.length,
      methodsAttempted: diagnostics.attemptedMethods.length,
      issuesIdentified: diagnostics.possibleIssues.length,
      fallbackAvailable: fallbackDataAvailable
    });

    return result;
  }

  /**
   * Get comprehensive authentication diagnostics
   */
  private getAuthenticationDiagnostics() {
    const user = this.client.getUser();
    const token = this.client.getToken();
    
    return {
      isAuthenticated: this.client.isAuthenticated(),
      hasToken: !!token,
      tokenLength: token?.length || 0,
      hasUser: !!user,
      username: user?.username || 'MISSING',
      userObject: user,
      hasRequiredCredentials: !!user?.username,
      authTimestamp: new Date().toISOString()
    };
  }

  /**
   * Try standard device query with detailed logging
   */
  private async attemptStandardDeviceQuery(): Promise<any> {
    const user = this.client.getUser();
    let username = user?.username;
    
    // CRITICAL FIX: Get username from localStorage if user object is missing
    if (!username) {
      username = localStorage.getItem('gps51_username');
      console.log('GPS51DeviceDiagnostics: Retrieved username from localStorage:', username);
    }
    
    if (!username) {
      throw new Error('Username is missing - cannot query device list');
    }

    console.log('📡 Standard device query parameters:', {
      username,
      hasToken: !!this.client.getToken(),
      userObject: user
    });

    // Use the client's standard method but capture full response
    const devices = await this.client.getDeviceList();
    
    return {
      devices,
      method: 'standard',
      username,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Try alternative API queries with different parameters
   */
  private async tryAlternativeQueries(): Promise<{
    devices: GPS51Device[];
    methods: string[];
    responses: any[];
  }> {
    const methods = [];
    const responses = [];
    let devices: GPS51Device[] = [];

    const user = this.client.getUser();
    const username = user?.username;
    const token = this.client.getToken();

    if (!username || !token) {
      return { devices: [], methods, responses };
    }

    // Alternative 1: Try different API action names
    const alternativeActions = ['getmonitorlist', 'devicelist', 'getdevices', 'monitors'];
    
    for (const action of alternativeActions) {
      try {
        methods.push(`Alternative action: ${action}`);
        console.log(`🔄 Trying alternative API action: ${action}`);
        
        const response = await this.makeAlternativeAPICall(action, { username }, token);
        responses.push({
          method: action,
          response: response,
          timestamp: new Date().toISOString()
        });

        const extractedDevices = this.extractDevicesFromResponse(response);
        if (extractedDevices.length > 0) {
          devices = extractedDevices;
          console.log(`✅ Alternative action ${action} found ${devices.length} devices`);
          break;
        }
      } catch (error) {
        console.warn(`❌ Alternative action ${action} failed:`, error);
        responses.push({
          method: action,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Alternative 2: Try with different parameter combinations
    if (devices.length === 0) {
      const paramVariations = [
        { username, format: 'json' },
        { username, type: 'all' },
        { username, active: 'true' },
        { loginame: username }, // Some GPS51 instances use loginame instead of username
        {} // Try without username parameter
      ];

      for (let i = 0; i < paramVariations.length; i++) {
        try {
          methods.push(`Parameter variation ${i + 1}`);
          console.log(`🔄 Trying parameter variation ${i + 1}:`, paramVariations[i]);
          
          const response = await this.makeAlternativeAPICall('querymonitorlist', paramVariations[i], token);
          responses.push({
            method: `param_variation_${i + 1}`,
            params: paramVariations[i],
            response: response,
            timestamp: new Date().toISOString()
          });

          const extractedDevices = this.extractDevicesFromResponse(response);
          if (extractedDevices.length > 0) {
            devices = extractedDevices;
            console.log(`✅ Parameter variation ${i + 1} found ${devices.length} devices`);
            break;
          }
        } catch (error) {
          console.warn(`❌ Parameter variation ${i + 1} failed:`, error);
          responses.push({
            method: `param_variation_${i + 1}`,
            params: paramVariations[i],
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return { devices, methods, responses };
  }

  /**
   * Make alternative API call through proxy
   */
  private async makeAlternativeAPICall(action: string, params: any, token: string): Promise<any> {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { data: proxyResponse, error: proxyError } = await supabase.functions.invoke('gps51-proxy', {
      body: {
        action,
        token,
        params,
        method: 'POST',
        apiUrl: 'https://api.gps51.com/openapi'
      }
    });

    if (proxyError) {
      throw new Error(`Proxy request failed: ${proxyError.message}`);
    }

    return proxyResponse;
  }

  /**
   * Extract devices from various response formats
   */
  private extractDevicesFromResponse(response: any): GPS51Device[] {
    if (!response) return [];

    // Standard groups format
    if (response.groups && Array.isArray(response.groups)) {
      let devices: GPS51Device[] = [];
      response.groups.forEach((group: any) => {
        if (group.devices && Array.isArray(group.devices)) {
          devices = devices.concat(group.devices);
        }
      });
      return devices;
    }

    // Direct devices array
    if (response.devices && Array.isArray(response.devices)) {
      return response.devices;
    }

    // Data field
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }

    // Monitors field (some GPS51 variants)
    if (response.monitors && Array.isArray(response.monitors)) {
      return response.monitors;
    }

    // Single level groups (flattened)
    if (Array.isArray(response)) {
      return response.filter(item => item.deviceid); // Filter for device-like objects
    }

    return [];
  }

  /**
   * Analyze GPS51 account characteristics
   */
  private async analyzeAccount(): Promise<GPS51AccountInfo> {
    // This would need to be expanded based on GPS51 API documentation
    // For now, provide basic analysis
    return {
      hasDevices: false, // To be determined by other methods
      accountType: 'standard',
      apiVariant: 'v1',
      requiresSpecialHandling: false
    };
  }

  /**
   * Try coordinator fallback
   */
  private async tryCoordinatorFallback(): Promise<GPS51Device[]> {
    const result = await gps51CoordinatorClient.sendRequest({
      action: 'getDeviceList',
      params: {},
      priority: 'high'
    });

    if (result.success && result.data) {
      return this.extractDevicesFromResponse(result.data);
    }

    throw new Error(result.error || 'Coordinator fallback failed');
  }

  /**
   * Generate recommendations based on diagnostic results
   */
  private generateRecommendations(diagnostics: any, accountInfo: GPS51AccountInfo): void {
    const recommendations = diagnostics.recommendations;

    // Authentication issues
    if (!diagnostics.authStatus.hasUser || !diagnostics.authStatus.username || diagnostics.authStatus.username === 'MISSING') {
      recommendations.push('Re-authenticate with GPS51 to ensure username is properly captured');
    }

    // Empty response issues
    if (diagnostics.possibleIssues.some(issue => issue.includes('empty groups array'))) {
      recommendations.push('Verify that your GPS51 account has devices assigned');
      recommendations.push('Check if devices are in a different group or organization');
      recommendations.push('Contact GPS51 support to verify account configuration');
    }

    // API connectivity issues
    if (diagnostics.possibleIssues.some(issue => issue.includes('failed'))) {
      recommendations.push('Check GPS51 API connectivity and credentials');
      recommendations.push('Verify that your GPS51 account has API access enabled');
    }

    // No devices found despite successful auth
    if (diagnostics.authStatus.isAuthenticated && diagnostics.apiResponses.every(r => !r.error)) {
      recommendations.push('Account authenticated but no devices returned - possible account configuration issue');
      recommendations.push('Try logging into GPS51 web interface to verify devices are visible there');
      recommendations.push('Check if devices require special permissions or are in a sub-account');
    }

    // General troubleshooting
    recommendations.push('Enable debug mode in GPS51 settings for more detailed logging');
    recommendations.push('Try refreshing credentials or re-authenticating');
  }
}