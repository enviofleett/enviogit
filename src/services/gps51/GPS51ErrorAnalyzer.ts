import { ErrorDetails } from '@/components/settings/GPS51ProductionValidator/types';

export class GPS51ErrorAnalyzer {
  static analyzeError(error: any, stepName: string): ErrorDetails {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    
    // CORS Error Detection
    if (errorMessage.includes('CORS') || 
        errorMessage.includes('Access-Control-Allow-Origin') ||
        errorMessage.includes('blocked by CORS policy')) {
      return {
        category: 'CORS',
        rootCause: 'Cross-Origin Resource Sharing (CORS) policy is blocking the request to GPS51 API',
        impact: 'Cannot connect to GPS51 servers from browser environment',
        recommendations: [
          'Use a CORS proxy service for development',
          'Deploy to production environment with proper CORS configuration',
          'Contact GPS51 support to whitelist your domain',
          'Use server-side proxy for API calls'
        ],
        quickFixes: [
          { label: 'Test Alternative Connection', action: 'test-proxy', description: 'Try connecting through emergency proxy' },
          { label: 'Clear Browser Cache', action: 'clear-cache', description: 'Clear browser cache and retry' }
        ],
        technicalDetails: { errorMessage, userAgent: navigator.userAgent }
      };
    }

    // Network Connectivity Issues
    if (errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('network error') ||
        errorMessage.includes('TypeError: Failed to fetch')) {
      return {
        category: 'NETWORK',
        rootCause: 'Network connectivity issue preventing API communication',
        impact: 'Cannot reach GPS51 servers due to network problems',
        recommendations: [
          'Check internet connection',
          'Verify GPS51 API server status',
          'Try again in a few minutes',
          'Check if firewall is blocking the connection'
        ],
        quickFixes: [
          { label: 'Test Connection', action: 'test-network', description: 'Test basic network connectivity' },
          { label: 'Retry with Timeout', action: 'retry-timeout', description: 'Retry with longer timeout period' }
        ],
        technicalDetails: { errorMessage, timestamp: new Date().toISOString() }
      };
    }

    // Authentication Errors
    if (errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Invalid credentials') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('401')) {
      return {
        category: 'AUTH',
        rootCause: 'GPS51 authentication credentials are invalid or expired',
        impact: 'Cannot access GPS51 API without valid authentication',
        recommendations: [
          'Verify username and password are correct',
          'Check if credentials have expired',
          'Re-enter credentials in GPS51 settings',
          'Contact GPS51 support if credentials should be valid'
        ],
        quickFixes: [
          { label: 'Open GPS51 Settings', action: 'open-settings', description: 'Go to GPS51 credentials panel' },
          { label: 'Clear Auth Cache', action: 'clear-auth', description: 'Clear stored authentication data' }
        ],
        technicalDetails: { errorMessage, hasCredentials: !!localStorage.getItem('gps51_credentials') }
      };
    }

    // Configuration Errors
    if (errorMessage.includes('No saved credentials') ||
        errorMessage.includes('Please authenticate first') ||
        stepName === 'Authentication' && errorMessage.includes('found')) {
      return {
        category: 'CONFIG',
        rootCause: 'GPS51 credentials have not been configured in the system',
        impact: 'Cannot start validation without proper GPS51 configuration',
        recommendations: [
          'Set up GPS51 credentials in Settings > GPS51 tab',
          'Ensure username and password are entered correctly',
          'Test credentials after setup',
          'Save credentials properly in the system'
        ],
        quickFixes: [
          { label: 'Setup Credentials', action: 'setup-credentials', description: 'Open credentials setup panel' },
          { label: 'Import Credentials', action: 'import-config', description: 'Import from backup configuration' }
        ],
        technicalDetails: { errorMessage, configExists: !!localStorage.getItem('gps51_credentials') }
      };
    }

    // API Response Errors
    if (errorMessage.includes('status') && (errorMessage.includes('500') || errorMessage.includes('503'))) {
      return {
        category: 'API',
        rootCause: 'GPS51 API server is experiencing issues or downtime',
        impact: 'GPS51 services are temporarily unavailable',
        recommendations: [
          'Wait and retry in a few minutes',
          'Check GPS51 service status page',
          'Use cached data if available',
          'Enable emergency mode for critical operations'
        ],
        quickFixes: [
          { label: 'Enable Emergency Mode', action: 'emergency-mode', description: 'Switch to emergency cached data' },
          { label: 'Check Service Status', action: 'check-status', description: 'Verify GPS51 API health' }
        ],
        technicalDetails: { errorMessage, timestamp: new Date().toISOString() }
      };
    }

    // Generic/Unknown Errors
    return {
      category: 'UNKNOWN',
      rootCause: 'An unexpected error occurred during validation',
      impact: 'Cannot complete production readiness validation',
      recommendations: [
        'Check browser console for detailed error messages',
        'Try refreshing the page and running validation again',
        'Check network connectivity',
        'Contact technical support with error details'
      ],
      quickFixes: [
        { label: 'View Console Logs', action: 'view-console', description: 'Open browser console for details' },
        { label: 'Full System Reset', action: 'full-reset', description: 'Clear all caches and restart' }
      ],
      technicalDetails: { errorMessage, errorStack, timestamp: new Date().toISOString() }
    };
  }
}