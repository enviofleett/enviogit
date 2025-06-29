
import { md5 } from 'js-md5';
import { GPS51AuthCredentials } from './GPS51Client';
import { GPS51_ENDPOINTS, GPS51_STATUS } from './GPS51ApiEndpoints';

export class GPS51AuthenticationClient {
  private validateMD5Hash(password: string): boolean {
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  async authenticateEndpoint(endpointType: 'standard' | 'openapi', credentials: GPS51AuthCredentials): Promise<{
    success: boolean;
    token?: string;
    user?: any;
    error?: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    const endpoint = GPS51_ENDPOINTS[endpointType];
    
    try {
      console.log(`🔐 Authenticating with ${endpoint.name} (${endpoint.baseUrl})...`);
      
      const hashedPassword = this.validateMD5Hash(credentials.password) 
        ? credentials.password 
        : md5(credentials.password);
      
      // Different login URL patterns for each endpoint
      const loginUrl = endpointType === 'openapi' 
        ? `${endpoint.baseUrl}?action=login`
        : `${endpoint.baseUrl}?action=login&token=`;
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FleetManagement/2.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          action: 'login',
          username: credentials.username,
          password: hashedPassword,
          from: credentials.from,
          type: credentials.type
        }),
        signal: AbortSignal.timeout(30000)
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log(`${endpoint.name} login response:`, result);

      if (result.status === GPS51_STATUS.SUCCESS && result.token) {
        console.log(`✅ ${endpoint.name} authentication successful (${responseTime}ms)`);
        return {
          success: true,
          token: result.token,
          user: result.user,
          responseTime
        };
      } else {
        throw new Error(`Authentication failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ${endpoint.name} authentication failed (${responseTime}ms):`, errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        responseTime
      };
    }
  }
}
