import { GPS51AuthenticationService, GPS51AuthenticationResult } from './GPS51AuthenticationService';
import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51Credentials } from '../gp51/GPS51CredentialsManager';

export interface TokenValidationResult {
  isValid: boolean;
  hasDataAccess: boolean;
  permissionIssues: string[];
  tokenExpiry?: Date;
  needsRefresh: boolean;
}

export interface GPS51PermissionDiagnostics {
  canAccessDeviceList: boolean;
  canAccessPositionData: boolean;
  authorizedDeviceCount: number;
  unauthorizedDevices: string[];
  permissionSummary: string;
}

/**
 * Enhanced GPS51 Token Manager with Permission Validation
 * Addresses the core issue: tokens valid for auth but lacking data access rights
 */
export class GPS51EnhancedTokenManager {
  private static instance: GPS51EnhancedTokenManager;
  private authService: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;
  private currentToken: string | null = null;
  private tokenObtainedAt: Date | null = null;
  private lastCredentials: GPS51Credentials | null = null;
  private permissionCache: Map<string, GPS51PermissionDiagnostics> = new Map();

  constructor() {
    this.authService = GPS51AuthenticationService.getInstance();
    this.proxyClient = GPS51ProxyClient.getInstance();
  }

  static getInstance(): GPS51EnhancedTokenManager {
    if (!GPS51EnhancedTokenManager.instance) {
      GPS51EnhancedTokenManager.instance = new GPS51EnhancedTokenManager();
    }
    return GPS51EnhancedTokenManager.instance;
  }

  /**
   * PHASE 1: Get fresh token with immediate validation
   */
  async getFreshToken(credentials: GPS51Credentials, forceRefresh: boolean = false): Promise<GPS51AuthenticationResult> {
    console.log('GPS51EnhancedTokenManager: Getting fresh token...', {
      forceRefresh,
      hasCurrentToken: !!this.currentToken,
      tokenAge: this.tokenObtainedAt ? Date.now() - this.tokenObtainedAt.getTime() : 0
    });

    // Force refresh if explicitly requested or token is older than 5 minutes
    const tokenAge = this.tokenObtainedAt ? Date.now() - this.tokenObtainedAt.getTime() : Infinity;
    const shouldRefresh = forceRefresh || !this.currentToken || tokenAge > 5 * 60 * 1000;

    if (!shouldRefresh && this.currentToken) {
      console.log('GPS51EnhancedTokenManager: Using cached token');
      return {
        success: true,
        token: this.currentToken,
        responseTime: 0
      };
    }

    console.log('GPS51EnhancedTokenManager: Refreshing token from GPS51 API...');
    const authResult = await this.authService.authenticate(credentials);
    
    if (authResult.success && authResult.token) {
      this.currentToken = authResult.token;
      this.tokenObtainedAt = new Date();
      this.lastCredentials = credentials;
      
      console.log('GPS51EnhancedTokenManager: Fresh token obtained:', {
        tokenLength: authResult.token.length,
        tokenPrefix: authResult.token.substring(0, 10) + '...',
        obtainedAt: this.tokenObtainedAt.toISOString()
      });
    }

    return authResult;
  }

  /**
   * PHASE 2: Validate token permissions beyond just presence
   */
  async validateTokenPermissions(token: string, credentials: GPS51Credentials): Promise<TokenValidationResult> {
    console.log('GPS51EnhancedTokenManager: Validating token permissions...');
    
    const validationResult: TokenValidationResult = {
      isValid: !!token,
      hasDataAccess: false,
      permissionIssues: [],
      needsRefresh: false
    };

    if (!token) {
      validationResult.permissionIssues.push('No token provided');
      validationResult.needsRefresh = true;
      return validationResult;
    }

    try {
      // Test 1: Can we access device list?
      console.log('GPS51EnhancedTokenManager: Testing device list access...');
      const deviceListResponse = await this.proxyClient.makeRequest(
        'querymonitorlist',
        token,
        { username: credentials.username },
        'POST',
        credentials.apiUrl
      );

      if (deviceListResponse.status === 0 && deviceListResponse.data) {
        console.log('GPS51EnhancedTokenManager: Device list access - SUCCESS', {
          groupCount: deviceListResponse.data.length
        });
      } else {
        validationResult.permissionIssues.push('Cannot access device list');
        if (deviceListResponse.status === 8902) {
          validationResult.needsRefresh = true;
        }
      }

      // Test 2: Can we access position data for a sample device?
      if (deviceListResponse.data && deviceListResponse.data.length > 0) {
        const firstGroup = deviceListResponse.data[0];
        if (firstGroup.children && firstGroup.children.length > 0) {
          const sampleDeviceId = firstGroup.children[0].deviceid;
          
          console.log('GPS51EnhancedTokenManager: Testing position data access...', {
            sampleDeviceId
          });

          const positionResponse = await this.proxyClient.makeRequest(
            'lastposition',
            token,
            {
              username: credentials.username,
              deviceids: [sampleDeviceId],
              lastquerypositiontime: 0
            },
            'POST',
            credentials.apiUrl
          );

          if (positionResponse.status === 0) {
            if (positionResponse.records && positionResponse.records.length > 0) {
              validationResult.hasDataAccess = true;
              console.log('GPS51EnhancedTokenManager: Position data access - SUCCESS');
            } else {
              validationResult.permissionIssues.push('Token lacks position data access rights');
              console.warn('GPS51EnhancedTokenManager: Position data access - PERMISSION DENIED (empty records)');
            }
          } else {
            validationResult.permissionIssues.push(`Position data request failed with status: ${positionResponse.status}`);
            if (positionResponse.status === 8902) {
              validationResult.needsRefresh = true;
            }
          }
        }
      }

    } catch (error) {
      console.error('GPS51EnhancedTokenManager: Token validation error:', error);
      validationResult.permissionIssues.push(`Validation error: ${error.message}`);
      validationResult.needsRefresh = true;
    }

    console.log('GPS51EnhancedTokenManager: Token validation complete:', validationResult);
    return validationResult;
  }

  /**
   * PHASE 3: Enhanced error detection for auth issues
   */
  detectAuthIssuesInResponse(response: any, action: string): {
    hasAuthIssue: boolean;
    issueType: 'token_expired' | 'permission_denied' | 'invalid_token' | 'rate_limited' | 'none';
    recommendation: string;
  } {
    // Check for explicit auth failure status codes
    if (response.status === 8902) {
      return {
        hasAuthIssue: true,
        issueType: 'rate_limited',
        recommendation: 'Rate limited - implement backoff and retry'
      };
    }

    if (response.status === 1 && action !== 'login') {
      return {
        hasAuthIssue: true,
        issueType: 'invalid_token',
        recommendation: 'Token invalid - refresh authentication'
      };
    }

    // Check for subtle permission issues (successful status but empty data)
    if (response.status === 0 && action === 'lastposition') {
      if (!response.records || response.records.length === 0) {
        return {
          hasAuthIssue: true,
          issueType: 'permission_denied',
          recommendation: 'Token lacks position data access rights - verify user permissions'
        };
      }
    }

    // Check for token expiry hints in message
    if (response.message && typeof response.message === 'string') {
      const lowerMessage = response.message.toLowerCase();
      if (lowerMessage.includes('token') || lowerMessage.includes('session') || lowerMessage.includes('expired')) {
        return {
          hasAuthIssue: true,
          issueType: 'token_expired',
          recommendation: 'Token likely expired - refresh authentication'
        };
      }
    }

    return {
      hasAuthIssue: false,
      issueType: 'none',
      recommendation: 'No auth issues detected'
    };
  }

  /**
   * PHASE 4: GPS51 Permission Diagnostics
   */
  async runPermissionDiagnostics(credentials: GPS51Credentials): Promise<GPS51PermissionDiagnostics> {
    console.log('GPS51EnhancedTokenManager: Running comprehensive permission diagnostics...');
    
    const cacheKey = `${credentials.username}@${credentials.apiUrl}`;
    if (this.permissionCache.has(cacheKey)) {
      console.log('GPS51EnhancedTokenManager: Returning cached diagnostics');
      return this.permissionCache.get(cacheKey)!;
    }

    const diagnostics: GPS51PermissionDiagnostics = {
      canAccessDeviceList: false,
      canAccessPositionData: false,
      authorizedDeviceCount: 0,
      unauthorizedDevices: [],
      permissionSummary: 'Unknown'
    };

    try {
      // Ensure we have a fresh token
      const authResult = await this.getFreshToken(credentials, true);
      if (!authResult.success || !authResult.token) {
        diagnostics.permissionSummary = 'Authentication failed - cannot run diagnostics';
        return diagnostics;
      }

      // Test device list access
      const deviceListResponse = await this.proxyClient.makeRequest(
        'querymonitorlist',
        authResult.token,
        { username: credentials.username },
        'POST',
        credentials.apiUrl
      );

      if (deviceListResponse.status === 0 && deviceListResponse.data) {
        diagnostics.canAccessDeviceList = true;
        
        // Count total devices across all groups
        let totalDevices = 0;
        const deviceIds: string[] = [];
        
        for (const group of deviceListResponse.data) {
          if (group.children) {
            totalDevices += group.children.length;
            deviceIds.push(...group.children.map(d => d.deviceid));
          }
        }

        console.log('GPS51EnhancedTokenManager: Found devices for testing:', {
          totalDevices,
          firstFewIds: deviceIds.slice(0, 5)
        });

        // Test position access for a sample of devices (max 5 to avoid overwhelming the API)
        const testDeviceIds = deviceIds.slice(0, Math.min(5, deviceIds.length));
        let authorizedCount = 0;

        for (const deviceId of testDeviceIds) {
          try {
            const positionResponse = await this.proxyClient.makeRequest(
              'lastposition',
              authResult.token,
              {
                username: credentials.username,
                deviceids: [deviceId],
                lastquerypositiontime: 0
              },
              'POST',
              credentials.apiUrl
            );

            if (positionResponse.status === 0 && positionResponse.records && positionResponse.records.length > 0) {
              authorizedCount++;
            } else {
              diagnostics.unauthorizedDevices.push(deviceId);
            }
          } catch (error) {
            diagnostics.unauthorizedDevices.push(deviceId);
          }

          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        diagnostics.authorizedDeviceCount = authorizedCount;
        diagnostics.canAccessPositionData = authorizedCount > 0;

        // Generate summary
        if (authorizedCount === 0) {
          diagnostics.permissionSummary = `No position data access (0/${testDeviceIds.length} devices tested)`;
        } else if (authorizedCount === testDeviceIds.length) {
          diagnostics.permissionSummary = `Full position data access (${authorizedCount}/${testDeviceIds.length} devices tested)`;
        } else {
          diagnostics.permissionSummary = `Partial position data access (${authorizedCount}/${testDeviceIds.length} devices tested)`;
        }

      } else {
        diagnostics.permissionSummary = 'Cannot access device list';
      }

    } catch (error) {
      console.error('GPS51EnhancedTokenManager: Diagnostics error:', error);
      diagnostics.permissionSummary = `Diagnostics failed: ${error.message}`;
    }

    // Cache results for 10 minutes
    this.permissionCache.set(cacheKey, diagnostics);
    setTimeout(() => this.permissionCache.delete(cacheKey), 10 * 60 * 1000);

    console.log('GPS51EnhancedTokenManager: Permission diagnostics complete:', diagnostics);
    return diagnostics;
  }

  /**
   * PHASE 5: Adaptive token strategy for data requests
   */
  async makeRequestWithFreshToken(
    action: string,
    params: Record<string, any>,
    credentials: GPS51Credentials,
    method: 'GET' | 'POST' = 'POST'
  ) {
    console.log('GPS51EnhancedTokenManager: Making request with fresh token strategy...', { action });

    // Step 1: Ensure we have a fresh token
    const authResult = await this.getFreshToken(credentials, false);
    if (!authResult.success || !authResult.token) {
      throw new Error(`Authentication failed: ${authResult.error}`);
    }

    // Step 2: Make the request
    const response = await this.proxyClient.makeRequest(
      action,
      authResult.token,
      params,
      method,
      credentials.apiUrl
    );

    // Step 3: Analyze response for auth issues
    const authIssueAnalysis = this.detectAuthIssuesInResponse(response, action);
    
    if (authIssueAnalysis.hasAuthIssue) {
      console.warn('GPS51EnhancedTokenManager: Auth issue detected:', authIssueAnalysis);
      
      // If it's a token issue, try once more with forced refresh
      if (authIssueAnalysis.issueType === 'token_expired' || authIssueAnalysis.issueType === 'invalid_token') {
        console.log('GPS51EnhancedTokenManager: Retrying with forced token refresh...');
        
        const freshAuthResult = await this.getFreshToken(credentials, true);
        if (freshAuthResult.success && freshAuthResult.token) {
          return await this.proxyClient.makeRequest(
            action,
            freshAuthResult.token,
            params,
            method,
            credentials.apiUrl
          );
        }
      }
      
      // Add auth issue info to response
      (response as any).authIssueDetected = authIssueAnalysis;
    }

    return response;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.currentToken = null;
    this.tokenObtainedAt = null;
    this.lastCredentials = null;
    this.permissionCache.clear();
    console.log('GPS51EnhancedTokenManager: Cache cleared');
  }
}