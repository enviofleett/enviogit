import { GPS51AuthenticationService } from './GPS51AuthenticationService';
import { GPS51ProxyClient } from './GPS51ProxyClient';
import { GPS51AuthCredentials } from './GPS51Types';

export interface PermissionValidationReport {
  timestamp: string;
  username: string;
  apiUrl: string;
  authenticationStatus: 'success' | 'failed';
  deviceListAccess: 'allowed' | 'denied' | 'unknown';
  positionDataAccess: 'allowed' | 'denied' | 'partial' | 'unknown';
  totalDevicesFound: number;
  testedDevices: number;
  authorizedDevices: number;
  unauthorizedDevices: string[];
  permissionSummary: string;
  recommendations: string[];
  criticalIssues: string[];
}

/**
 * GPS51 Permission Validator
 * Provides comprehensive analysis of user permissions and data access rights
 */
export class GPS51PermissionValidator {
  private static instance: GPS51PermissionValidator;
  private authService: GPS51AuthenticationService;
  private proxyClient: GPS51ProxyClient;

  constructor() {
    this.authService = GPS51AuthenticationService.getInstance();
    this.proxyClient = GPS51ProxyClient.getInstance();
  }

  static getInstance(): GPS51PermissionValidator {
    if (!GPS51PermissionValidator.instance) {
      GPS51PermissionValidator.instance = new GPS51PermissionValidator();
    }
    return GPS51PermissionValidator.instance;
  }

  /**
   * Run comprehensive permission validation
   */
  async validatePermissions(credentials: GPS51AuthCredentials): Promise<PermissionValidationReport> {
    console.log('GPS51PermissionValidator: Starting comprehensive permission validation...');
    
    const report: PermissionValidationReport = {
      timestamp: new Date().toISOString(),
      username: credentials.username,
      apiUrl: credentials.apiUrl,
      authenticationStatus: 'failed',
      deviceListAccess: 'unknown',
      positionDataAccess: 'unknown',
      totalDevicesFound: 0,
      testedDevices: 0,
      authorizedDevices: 0,
      unauthorizedDevices: [],
      permissionSummary: 'Validation in progress...',
      recommendations: [],
      criticalIssues: []
    };

    try {
      // Step 1: Test authentication using GPS51AuthenticationService directly
      console.log('GPS51PermissionValidator: Step 1 - Testing authentication...');
      const authResult = await this.authService.authenticate(credentials);
      
      if (!authResult.success || !authResult.token) {
        report.authenticationStatus = 'failed';
        report.criticalIssues.push(`Authentication failed: ${authResult.error || 'Unknown error'}`);
        report.permissionSummary = 'Cannot authenticate with GPS51 API';
        report.recommendations.push('Verify username and password are correct');
        report.recommendations.push('Check API URL is accessible and correct');
        report.recommendations.push('Ensure GPS51 account is active and not locked');
        return report;
      }

      report.authenticationStatus = 'success';
      console.log('GPS51PermissionValidator: ✅ Authentication successful');

      // Step 2: Test device list access
      console.log('GPS51PermissionValidator: Step 2 - Testing device list access...');
      try {
        const deviceListResponse = await this.proxyClient.makeRequest(
          'querymonitorlist',
          authResult.token,
          { username: credentials.username },
          'POST',
          credentials.apiUrl
        );

        if (deviceListResponse.status === 0 && deviceListResponse.data) {
          report.deviceListAccess = 'allowed';
          report.totalDevicesFound = this.countTotalDevices(deviceListResponse.data);
          console.log('GPS51PermissionValidator: ✅ Device list access successful:', {
            totalDevices: report.totalDevicesFound
          });
        } else {
          report.deviceListAccess = 'denied';
          report.criticalIssues.push(`Device list access denied: Status ${deviceListResponse.status}`);
        }
      } catch (error) {
        report.deviceListAccess = 'denied';
        report.criticalIssues.push(`Device list request failed: ${error.message}`);
      }

      // Step 3: Test position data access (only if device list works)
      if (report.deviceListAccess === 'allowed' && report.totalDevicesFound > 0) {
        console.log('GPS51PermissionValidator: Step 3 - Testing position data access...');
        
        try {
          const deviceListResponse = await this.proxyClient.makeRequest(
            'querymonitorlist',
            authResult.token,
            { username: credentials.username },
            'POST',
            credentials.apiUrl
          );

          const deviceIds = this.extractDeviceIds(deviceListResponse.data);
          const testDeviceIds = deviceIds.slice(0, Math.min(3, deviceIds.length)); // Test max 3 devices
          report.testedDevices = testDeviceIds.length;

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
                report.unauthorizedDevices.push(deviceId);
              }
            } catch (error) {
              report.unauthorizedDevices.push(deviceId);
            }
            
            // Small delay to avoid overwhelming API
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          report.authorizedDevices = authorizedCount;
          
          if (authorizedCount === 0) {
            report.positionDataAccess = 'denied';
            report.criticalIssues.push('No position data access for any tested devices');
          } else if (authorizedCount === testDeviceIds.length) {
            report.positionDataAccess = 'allowed';
          } else {
            report.positionDataAccess = 'partial';
          }

          console.log('GPS51PermissionValidator: ✅ Position data test complete:', {
            tested: testDeviceIds.length,
            authorized: authorizedCount,
            access: report.positionDataAccess
          });

        } catch (error) {
          report.positionDataAccess = 'denied';
          report.criticalIssues.push(`Position data test failed: ${error.message}`);
        }
      }

      // Step 4: Generate summary and recommendations
      this.generateSummaryAndRecommendations(report);

      console.log('GPS51PermissionValidator: Validation complete:', {
        authenticationStatus: report.authenticationStatus,
        deviceListAccess: report.deviceListAccess,
        positionDataAccess: report.positionDataAccess,
        authorizedDevices: report.authorizedDevices,
        criticalIssuesCount: report.criticalIssues.length
      });

    } catch (error) {
      console.error('GPS51PermissionValidator: Validation error:', error);
      report.criticalIssues.push(`Validation error: ${error.message}`);
      report.permissionSummary = 'Validation failed due to technical error';
      report.recommendations.push('Check network connectivity and try again');
    }

    return report;
  }

  /**
   * Count total devices across all groups
   */
  private countTotalDevices(groups: any[]): number {
    let total = 0;
    for (const group of groups) {
      if (group.children) {
        total += group.children.length;
      }
    }
    return total;
  }

  /**
   * Extract device IDs from group structure
   */
  private extractDeviceIds(groups: any[]): string[] {
    const deviceIds: string[] = [];
    for (const group of groups) {
      if (group.children) {
        deviceIds.push(...group.children.map(d => d.deviceid));
      }
    }
    return deviceIds;
  }

  /**
   * Generate summary and actionable recommendations
   */
  private generateSummaryAndRecommendations(report: PermissionValidationReport): void {
    // Generate summary based on results
    if (report.authenticationStatus === 'failed') {
      report.permissionSummary = 'Authentication failed - cannot proceed with permission tests';
      report.recommendations.push('Verify GPS51 credentials are correct');
      report.recommendations.push('Ensure API URL is accessible and valid');
      report.recommendations.push('Check if GPS51 account is active and not locked');
      return;
    }

    if (report.deviceListAccess === 'denied') {
      report.permissionSummary = 'Cannot access device list - basic functionality blocked';
      report.recommendations.push('Contact GPS51 administrator to grant device list access');
      report.recommendations.push('Verify user account has minimum required permissions');
      report.criticalIssues.push('User lacks basic device list access');
      return;
    }

    if (report.totalDevicesFound === 0) {
      report.permissionSummary = 'No devices found in GPS51 account';
      report.recommendations.push('Verify devices are properly configured in GPS51 system');
      report.recommendations.push('Check if user has access to the correct GPS51 account');
      return;
    }

    // Position data access analysis
    if (report.positionDataAccess === 'denied') {
      report.permissionSummary = `Can see ${report.totalDevicesFound} devices but cannot access position data`;
      report.recommendations.push('🚨 CRITICAL: User lacks position data access rights');
      report.recommendations.push('Contact GPS51 admin to grant position data permissions');
      report.recommendations.push('Verify user has appropriate role/permissions in GPS51 system');
      report.criticalIssues.push('No position data access - core tracking functionality blocked');
    } else if (report.positionDataAccess === 'partial') {
      report.permissionSummary = `Partial access: ${report.authorizedDevices}/${report.testedDevices} devices accessible`;
      report.recommendations.push('⚠️ Partial position data access detected');
      report.recommendations.push('Some devices may be restricted - review device-specific permissions');
      report.recommendations.push(`${report.unauthorizedDevices.length} devices require permission review`);
    } else if (report.positionDataAccess === 'allowed') {
      report.permissionSummary = `Full access: ${report.authorizedDevices}/${report.testedDevices} tested devices accessible`;
      report.recommendations.push('✅ Permissions are working correctly');
      report.recommendations.push('GPS51 integration is ready for production use');
      report.recommendations.push('Monitor for any access issues during regular operation');
    }

    // Performance recommendations
    if (report.authorizedDevices === 0 && report.deviceListAccess === 'allowed') {
      report.criticalIssues.push('Device visibility without data access rights - permission configuration issue');
    }
  }

  /**
   * Quick permission check for specific device
   */
  async checkDevicePermission(deviceId: string, credentials: GPS51AuthCredentials): Promise<{
    hasAccess: boolean;
    error?: string;
    lastPosition?: any;
  }> {
    try {
      // Authenticate first
      const authResult = await this.authService.authenticate(credentials);
      if (!authResult.success || !authResult.token) {
        return {
          hasAccess: false,
          error: `Authentication failed: ${authResult.error}`
        };
      }

      // Test position access
      const response = await this.proxyClient.makeRequest(
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

      return {
        hasAccess: response.status === 0 && response.records && response.records.length > 0,
        lastPosition: response.records && response.records.length > 0 ? response.records[0] : null
      };
    } catch (error) {
      return {
        hasAccess: false,
        error: error.message
      };
    }
  }
}