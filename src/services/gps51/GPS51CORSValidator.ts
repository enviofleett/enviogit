/**
 * Phase 2: CORS Configuration Validator
 * Validates and provides guidance for GPS51 CORS setup
 */
export class GPS51CORSValidator {
  
  /**
   * Test CORS configuration for GPS51 API
   */
  static async validateCORS(): Promise<{
    isValid: boolean;
    status: string;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    try {
      console.log('GPS51CORSValidator: Testing CORS configuration...');
      
      // Test preflight request
      const preflightResponse = await fetch('https://api.gps51.com/openapi', {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization'
        }
      });

      const allowOrigin = preflightResponse.headers.get('Access-Control-Allow-Origin');
      const allowMethods = preflightResponse.headers.get('Access-Control-Allow-Methods');
      const allowHeaders = preflightResponse.headers.get('Access-Control-Allow-Headers');

      console.log('GPS51CORSValidator: CORS headers received:', {
        allowOrigin,
        allowMethods,
        allowHeaders,
        status: preflightResponse.status
      });

      if (!allowOrigin || allowOrigin === 'null') {
        recommendations.push('GPS51 API server needs Access-Control-Allow-Origin header');
        recommendations.push('Contact GPS51 admin to add your domain to allowed origins');
        return {
          isValid: false,
          status: 'cors_not_configured',
          recommendations
        };
      }

      if (allowOrigin !== '*' && !allowOrigin.includes(window.location.origin)) {
        recommendations.push(`GPS51 API allows origin: ${allowOrigin}`);
        recommendations.push(`Your domain: ${window.location.origin} needs to be added`);
        return {
          isValid: false,
          status: 'domain_not_allowed',
          recommendations
        };
      }

      return {
        isValid: true,
        status: 'cors_configured',
        recommendations: ['CORS is properly configured']
      };

    } catch (error) {
      console.error('GPS51CORSValidator: CORS test failed:', error);
      
      if (error instanceof TypeError && error.message.includes('CORS')) {
        recommendations.push('CORS blocking detected - GPS51 server configuration needed');
        recommendations.push('Use GPS51 proxy through Supabase edge functions as workaround');
        return {
          isValid: false,
          status: 'cors_blocked',
          recommendations
        };
      }
      
      recommendations.push('Network error during CORS test');
      recommendations.push('Check internet connection and GPS51 API availability');
      return {
        isValid: false,
        status: 'network_error',
        recommendations
      };
    }
  }

  /**
   * Get CORS troubleshooting steps
   */
  static getCORSTroubleshootingSteps(): string[] {
    return [
      '1. Contact GPS51 platform administrator',
      '2. Request to add your domain to Access-Control-Allow-Origin',
      `3. Your domain: ${window.location.origin}`,
      '4. Required headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers',
      '5. Alternative: Use Supabase proxy (gps51-proxy) which bypasses CORS'
    ];
  }
}

// Track active GPS51 data sources globally
declare global {
  interface Window {
    GPS51ActiveHooks?: Record<string, boolean>;
    GPS51LegacyServices?: Record<string, { stop: () => void }>;
  }
}

// Register useGPS51Data as active
if (typeof window !== 'undefined') {
  window.GPS51ActiveHooks = window.GPS51ActiveHooks || {};
  window.GPS51ActiveHooks['useGPS51Data'] = true;
}