
import { md5 } from 'js-md5';

export interface GPS51Credentials {
  apiUrl: string;
  username: string;
  password: string;
  loginFrom: string;
  loginType: string;
}

export interface GPS51ApiResponse {
  status: number;
  message?: string;
  cause?: string;
  token?: string;
  user?: any;
  data?: any;
  groups?: any[];
  records?: any[];
}

export class GPS51Service {
  private apiUrl: string;
  private username: string;
  private password: string;
  private loginFrom: string;
  private loginType: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(credentials?: GPS51Credentials) {
    if (credentials) {
      this.apiUrl = credentials.apiUrl;
      this.username = credentials.username;
      this.password = credentials.password;
      this.loginFrom = credentials.loginFrom;
      this.loginType = credentials.loginType;
    } else {
      // Load from localStorage or environment
      this.loadCredentials();
    }

    this.validateCredentials();
  }

  private loadCredentials(): void {
    console.log('Loading GPS51 credentials...');
    
    // Try localStorage first (for frontend)
    if (typeof window !== 'undefined') {
      this.apiUrl = localStorage.getItem('gps51_api_url') || 'https://api.gps51.com/openapi';
      this.username = localStorage.getItem('gps51_username') || '';
      this.password = localStorage.getItem('gps51_password_hash') || '';
      this.loginFrom = localStorage.getItem('gps51_from') || 'WEB';
      this.loginType = localStorage.getItem('gps51_type') || 'USER';
    } else {
      // For server-side/edge functions, use environment variables
      this.apiUrl = process.env.GPS51_API_URL || 'https://api.gps51.com/openapi';
      this.username = process.env.GPS51_USERNAME || '';
      this.password = process.env.GPS51_PASSWORD_HASH || '';
      this.loginFrom = process.env.GPS51_LOGIN_FROM || 'WEB';
      this.loginType = process.env.GPS51_LOGIN_TYPE || 'USER';
    }

    console.log('GPS51 credentials loaded:', {
      apiUrl: this.apiUrl,
      username: this.username ? this.username.substring(0, 3) + '***' : 'MISSING',
      hasPassword: !!this.password,
      passwordLength: this.password?.length || 0,
      loginFrom: this.loginFrom,
      loginType: this.loginType
    });
  }

  private validateCredentials(): void {
    const missing = [];
    
    if (!this.apiUrl) missing.push('apiUrl');
    if (!this.username) missing.push('username');
    if (!this.password) missing.push('password');
    
    if (missing.length > 0) {
      throw new Error(`GPS51 credentials not configured. Missing: ${missing.join(', ')}`);
    }

    // Validate API URL format
    try {
      new URL(this.apiUrl);
    } catch {
      throw new Error('Invalid GPS51 API URL format');
    }

    // Ensure we're using the correct API endpoint
    if (!this.apiUrl.includes('/openapi')) {
      console.warn('GPS51 API URL should use the /openapi endpoint');
    }
  }

  private hashPassword(password: string): string {
    // Check if password is already MD5 hashed (32 hex characters)
    if (/^[a-f0-9]{32}$/.test(password)) {
      return password.toLowerCase();
    }
    
    // Hash plain text password to MD5
    return md5(password).toLowerCase();
  }

  private isTokenExpired(): boolean {
    if (!this.token || !this.tokenExpiry) {
      return true;
    }
    
    // Consider token expired 5 minutes before actual expiry for safety
    const safetyMargin = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() > (this.tokenExpiry.getTime() - safetyMargin);
  }

  async login(): Promise<string> {
    console.log('=== GPS51 LOGIN ATTEMPT ===');
    console.log('Login URL:', this.apiUrl);
    
    const hashedPassword = this.hashPassword(this.password);
    
    const loginPayload = {
      action: 'login',
      username: this.username,
      password: hashedPassword,
      from: this.loginFrom,
      type: this.loginType
    };

    console.log('Login payload:', {
      action: loginPayload.action,
      username: loginPayload.username,
      passwordLength: loginPayload.password.length,
      isValidMD5: /^[a-f0-9]{32}$/.test(loginPayload.password),
      from: loginPayload.from,
      type: loginPayload.type
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GPS51ApiResponse = await response.json();
      
      console.log('GPS51 login response:', {
        status: data.status,
        message: data.message,
        hasToken: !!data.token,
        cause: data.cause
      });

      if (data.status === 0 && data.token) {
        this.token = data.token;
        // Set token expiry (GPS51 tokens typically last 24 hours)
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours
        
        console.log('✅ GPS51 login successful, token acquired');
        return this.token;
      } else {
        const errorMsg = data.cause || data.message || `Login failed with status: ${data.status}`;
        console.error('❌ GPS51 login failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ GPS51 login error:', error);
      throw error;
    }
  }

  async makeAuthenticatedRequest(action: string, params: any = {}): Promise<GPS51ApiResponse> {
    console.log(`=== GPS51 ${action.toUpperCase()} REQUEST ===`);
    
    // Ensure we have a valid token
    if (!this.token || this.isTokenExpired()) {
      console.log('Token missing or expired, logging in...');
      await this.login();
    }

    const requestPayload = {
      action,
      token: this.token,
      ...params
    };

    console.log(`${action} request payload:`, {
      action: requestPayload.action,
      hasToken: !!requestPayload.token,
      tokenLength: requestPayload.token?.length || 0,
      paramsKeys: Object.keys(params)
    });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GPS51ApiResponse = await response.json();
      
      console.log(`${action} response:`, {
        status: data.status,
        message: data.message,
        hasData: !!data.data,
        hasGroups: !!data.groups,
        hasRecords: !!data.records,
        cause: data.cause
      });

      // Handle token expiration
      if (data.status === 1 && data.cause?.toLowerCase().includes('token')) {
        console.log('Token expired, re-authenticating...');
        this.token = null;
        this.tokenExpiry = null;
        await this.login();
        
        // Retry the request with new token
        return this.makeAuthenticatedRequest(action, params);
      }

      return data;
    } catch (error) {
      console.error(`❌ GPS51 ${action} error:`, error);
      throw error;
    }
  }

  // Convenience methods for common operations
  async getDeviceList(): Promise<any[]> {
    const response = await this.makeAuthenticatedRequest('querymonitorlist', {
      username: this.username
    });
    
    let devices: any[] = [];
    if (response.status === 0 && response.groups) {
      response.groups.forEach((group: any) => {
        if (group.devices && Array.isArray(group.devices)) {
          devices = devices.concat(group.devices);
        }
      });
    }
    
    return devices;
  }

  async getLastPositions(deviceIds: string[] = [], lastQueryTime: number = 0): Promise<any[]> {
    if (deviceIds.length === 0) {
      // Get all device IDs first
      const devices = await this.getDeviceList();
      deviceIds = devices.map(d => d.deviceid);
    }

    const response = await this.makeAuthenticatedRequest('lastposition', {
      deviceids: deviceIds,
      lastquerypositiontime: lastQueryTime
    });

    if (response.status === 0) {
      return response.records || response.data || [];
    }
    
    return [];
  }

  // Check if service is properly configured
  static isConfigured(): boolean {
    try {
      new GPS51Service();
      return true;
    } catch {
      return false;
    }
  }

  // Get current configuration status
  getConfigurationStatus(): {
    isConfigured: boolean;
    missingCredentials: string[];
    apiUrl: string;
    username: string;
  } {
    const missing = [];
    
    if (!this.apiUrl) missing.push('apiUrl');
    if (!this.username) missing.push('username');
    if (!this.password) missing.push('password');
    
    return {
      isConfigured: missing.length === 0,
      missingCredentials: missing,
      apiUrl: this.apiUrl,
      username: this.username
    };
  }
}

// Export singleton instance
export const gps51Service = new GPS51Service();
