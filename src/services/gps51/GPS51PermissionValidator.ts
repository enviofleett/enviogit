import { GPS51EnhancedTokenManager } from './GPS51EnhancedTokenManager';
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
  private tokenManager: GPS51EnhancedTokenManager;

  constructor() {
    this.tokenManager = GPS51EnhancedTokenManager.getInstance();
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
      // Step 1: Test authentication
      console.log('GPS51PermissionValidator: Step 1 - Testing authentication...');
      const authResult = await this.tokenManager.getFreshToken(credentials, true);
      
      if (!authResult.success || !authResult.token) {
        report.authenticationStatus = 'failed';
        report.criticalIssues.push('Authentication failed - verify credentials');
        report.permissionSummary = 'Cannot authenticate with GPS51 API';
        report.recommendations.push('Verify username and password are correct');
        report.recommendations.push('Check API URL is accessible');
        return report;
      }

      report.authenticationStatus = 'success';
      console.log('GPS51PermissionValidator: Authentication successful');

      // Step 2: Test token permissions
      console.log('GPS51PermissionValidator: Step 2 - Validating token permissions...');
      const tokenValidation = await this.tokenManager.validateTokenPermissions(authResult.token, credentials);
      
      if (tokenValidation.permissionIssues.length > 0) {
        report.criticalIssues.push(...tokenValidation.permissionIssues);
      }

      // Step 3: Run detailed permission diagnostics
      console.log('GPS51PermissionValidator: Step 3 - Running detailed diagnostics...');
      const diagnostics = await this.tokenManager.runPermissionDiagnostics(credentials);
      
      // Populate report with diagnostics results
      report.deviceListAccess = diagnostics.canAccessDeviceList ? 'allowed' : 'denied';
      report.authorizedDevices = diagnostics.authorizedDeviceCount;
      report.unauthorizedDevices = diagnostics.unauthorizedDevices;
      report.permissionSummary = diagnostics.permissionSummary;

      if (diagnostics.canAccessPositionData) {
        if (diagnostics.authorizedDeviceCount > 0) {
          report.positionDataAccess = diagnostics.unauthorizedDevices.length > 0 ? 'partial' : 'allowed';
        } else {
          report.positionDataAccess = 'denied';
        }
      } else {
        report.positionDataAccess = 'denied';
      }

      // Step 4: Generate recommendations based on findings
      this.generateRecommendations(report, diagnostics, tokenValidation);

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
   * Generate actionable recommendations based on validation results
   */
  private generateRecommendations(
    report: PermissionValidationReport,
    diagnostics: any,
    tokenValidation: any
  ): void {
    // Authentication recommendations
    if (report.authenticationStatus === 'failed') {
      report.recommendations.push('Verify GPS51 credentials are correct');
      report.recommendations.push('Ensure API URL is accessible and valid');
      return; // No point in other recommendations if auth fails
    }

    // Device list access recommendations
    if (report.deviceListAccess === 'denied') {
      report.recommendations.push('Contact GPS51 admin to grant device list access');
      report.criticalIssues.push('User lacks basic device list access');
    }

    // Position data access recommendations
    if (report.positionDataAccess === 'denied') {
      report.recommendations.push('CRITICAL: User lacks position data access rights');
      report.recommendations.push('Contact GPS51 admin to grant position data permissions');
      report.recommendations.push('Verify user has appropriate role/permissions in GPS51 system');
      report.criticalIssues.push('No position data access - core functionality blocked');
    } else if (report.positionDataAccess === 'partial') {
      report.recommendations.push('Partial position data access detected');
      report.recommendations.push('Some devices may be restricted - review device-specific permissions');
      report.recommendations.push(`${report.unauthorizedDevices.length} devices are unauthorized`);
    }

    // Token-specific recommendations
    if (tokenValidation.needsRefresh) {
      report.recommendations.push('Implement automatic token refresh for better reliability');
    }

    if (tokenValidation.permissionIssues.length > 0) {
      report.recommendations.push('Token has permission limitations - review user role');
    }

    // Performance recommendations
    if (report.authorizedDevices === 0 && report.deviceListAccess === 'allowed') {
      report.recommendations.push('CRITICAL: Can see devices but cannot access position data');
      report.recommendations.push('This indicates a GPS51 permission configuration issue');
      report.criticalIssues.push('Device visibility without data access rights');
    }

    // General recommendations
    if (report.criticalIssues.length === 0) {
      report.recommendations.push('Permissions appear to be working correctly');
      report.recommendations.push('Monitor for any access issues during regular operation');
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
      const response = await this.tokenManager.makeRequestWithFreshToken(
        'lastposition',
        {
          username: credentials.username,
          deviceids: [deviceId],
          lastquerypositiontime: 0
        },
        credentials
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