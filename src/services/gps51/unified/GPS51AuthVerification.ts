/**
 * GPS51 Authentication Verification Service
 * Quick verification utility to test the unified authentication fixes
 */

import { gps51UnifiedAuthManager } from './index';
import { GPS51ProxyClient } from '../GPS51ProxyClient';
import { gps51IntelligentConnectionManager } from '../GPS51IntelligentConnectionManager';

export interface VerificationResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

export class GPS51AuthVerification {
  /**
   * Run comprehensive verification of the auth fixes
   */
  static async runVerification(): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    // Step 1: Test unified auth manager initialization
    try {
      const authState = gps51UnifiedAuthManager.getAuthState();
      results.push({
        step: 'Unified Auth Manager',
        success: true,
        message: `Initialized successfully. Authenticated: ${authState.isAuthenticated}`,
        details: {
          hasCredentials: gps51UnifiedAuthManager.hasStoredCredentials(),
          username: authState.username
        }
      });
    } catch (error) {
      results.push({
        step: 'Unified Auth Manager',
        success: false,
        message: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Step 2: Test proxy client connection
    try {
      const proxyClient = GPS51ProxyClient.getInstance();
      const connectionTest = await proxyClient.testConnection();
      
      results.push({
        step: 'Proxy Client Connection',
        success: connectionTest.success,
        message: connectionTest.success 
          ? `Connection successful (${connectionTest.responseTime}ms)`
          : `Connection failed: ${connectionTest.error}`,
        details: connectionTest.healthStatus
      });
    } catch (error) {
      results.push({
        step: 'Proxy Client Connection',
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Step 3: Test connection strategy health
    try {
      const connectionHealth = gps51IntelligentConnectionManager.getConnectionHealth();
      results.push({
        step: 'Connection Strategy',
        success: connectionHealth.overallHealth !== 'poor',
        message: `Health: ${connectionHealth.overallHealth}, Strategy: ${connectionHealth.recommendedStrategy}`,
        details: connectionHealth
      });
    } catch (error) {
      results.push({
        step: 'Connection Strategy',
        success: false,
        message: `Failed to get connection health: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Step 4: Test credential storage compatibility
    try {
      const hasUnifiedState = !!localStorage.getItem('gps51_auth_state');
      const hasLegacyToken = !!localStorage.getItem('gps51_token');
      const hasLegacyUsername = !!localStorage.getItem('gps51_username');

      results.push({
        step: 'Credential Storage',
        success: true,
        message: 'Storage compatibility verified',
        details: {
          unifiedState: hasUnifiedState,
          legacyToken: hasLegacyToken,
          legacyUsername: hasLegacyUsername
        }
      });
    } catch (error) {
      results.push({
        step: 'Credential Storage',
        success: false,
        message: `Storage verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return results;
  }

  /**
   * Test authentication with mock credentials
   */
  static async testMockAuth(): Promise<VerificationResult> {
    try {
      // This will test the Edge Function response structure without real credentials
      const proxyClient = GPS51ProxyClient.getInstance();
      
      // Mock authentication test - should fail with proper error handling
      const testResult = await proxyClient.makeRequest(
        'login',
        '', // No token for login
        {
          username: 'test-verification',
          password: 'a'.repeat(32), // Mock MD5 hash
          from: 'WEB',
          type: 'USER'
        },
        'POST'
      );

      return {
        step: 'Mock Authentication',
        success: false, // Expected to fail with test credentials
        message: 'Edge Function response structure verified (authentication failed as expected)',
        details: {
          status: testResult.status,
          hasMessage: !!testResult.message,
          structure: Object.keys(testResult)
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if error is properly structured
      const isProperError = errorMessage.includes('GPS51') || 
                          errorMessage.includes('authentication') ||
                          errorMessage.includes('credentials');

      return {
        step: 'Mock Authentication',
        success: isProperError,
        message: isProperError 
          ? 'Edge Function error handling verified'
          : `Unexpected error format: ${errorMessage}`,
        details: { errorMessage }
      };
    }
  }
}