
import { gps51ConfigManager } from './GPS51ConfigurationManager';
import { GPS51Credentials } from './GPS51Service';
import { CredentialsValidator } from '@/components/settings/components/CredentialsValidator';

export interface GPS51ConnectionCredentials {
  apiUrl: string;
  username: string;
  password: string;
  from?: string;
  type?: string;
}

export interface GPS51ConnectionResult {
  success: boolean;
  error?: string;
  vehiclesSynced?: number;
  positionsStored?: number;
}

export class GPS51ConnectionService {
  async connect(credentials: GPS51ConnectionCredentials): Promise<GPS51ConnectionResult> {
    try {
      console.log('=== GPS51 CONNECTION SERVICE ===');
      console.log('Attempting to connect with credentials...');

      // Validate credentials first
      const validation = CredentialsValidator.validateCredentials({
        apiUrl: credentials.apiUrl,
        username: credentials.username,
        password: credentials.password,
        from: credentials.from,
        type: credentials.type
      });

      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Prepare credentials with proper hashing
      const hashedPassword = CredentialsValidator.hashPassword(credentials.password);
      
      const gps51Credentials: GPS51Credentials = {
        apiUrl: credentials.apiUrl,
        username: credentials.username,
        password: hashedPassword,
        loginFrom: credentials.from || 'WEB',
        loginType: credentials.type || 'USER'
      };

      // Configure the GPS51 service
      await gps51ConfigManager.configure(gps51Credentials);

      // Test the connection by fetching device list
      const testResult = await gps51ConfigManager.testConnection();
      
      if (testResult.success) {
        console.log('✅ GPS51 connection successful');
        return {
          success: true,
          vehiclesSynced: testResult.deviceCount || 0
        };
      } else {
        console.error('❌ GPS51 connection test failed:', testResult.error);
        return {
          success: false,
          error: testResult.error
        };
      }
    } catch (error) {
      console.error('❌ GPS51 connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  disconnect(): void {
    console.log('Disconnecting GPS51 service...');
    gps51ConfigManager.clearConfiguration();
  }

  async refresh(): Promise<GPS51ConnectionResult> {
    try {
      console.log('=== GPS51 REFRESH ===');
      
      const service = gps51ConfigManager.getService();
      if (!service) {
        return {
          success: false,
          error: 'GPS51 service not configured'
        };
      }

      // Fetch fresh data
      const devices = await service.getDeviceList();
      const positions = await service.getLastPositions();

      console.log('✅ GPS51 refresh successful:', {
        deviceCount: devices.length,
        positionCount: positions.length
      });

      return {
        success: true,
        vehiclesSynced: devices.length,
        positionsStored: positions.length
      };
    } catch (error) {
      console.error('❌ GPS51 refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refresh failed'
      };
    }
  }

  isConfigured(): boolean {
    return gps51ConfigManager.isConfigured();
  }

  getConfigurationStatus() {
    return gps51ConfigManager.getConfigurationStatus();
  }
}
