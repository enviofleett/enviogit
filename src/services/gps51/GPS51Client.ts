
import { md5 } from 'js-md5';

export interface GPS51AuthCredentials {
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
  apiUrl: string;
}

export interface GPS51User {
  username: string;
  usertype: number;
  companyname: string;
  showname: string;
  multilogin: number;
  logintime?: number;
  expiretime?: number;
}

export interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: number;
  simnum: string;
  lastactivetime: number;
  isfree: number;
  allowedit: number;
  icon: number;
  callat: number;
  callon: number;
  speed: number;
  course: number;
  updatetime: number;
  status: number;
  moving: number;
  strstatus?: string;
  totaldistance?: number;
  altitude?: number;
  radius?: number;
}

export interface GPS51Position {
  deviceid: string;
  devicetime: number;
  callat: number;
  callon: number;
  altitude: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  updatetime: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
  radius?: number;
  gotsrc?: string;
  rxlevel?: number;
  voltagepercent?: number;
}

export interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
  user?: GPS51User;
  devices?: GPS51Device[];
  positions?: GPS51Position[];
}

const GPS51_STATUS = {
  SUCCESS: 0,
  FAILED: 1,
  PASSWORD_ERROR: 1,
  OFFLINE_NOT_CACHE: 2,
  OFFLINE_CACHED: 3,
  TOKEN_INVALID: 4,
  NO_PERMISSION: 5,
} as const;

export class GPS51Client {
  private baseURL: string;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private user: GPS51User | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(baseURL = 'https://www.gps51.com/webapi') {
    this.baseURL = baseURL;
  }

  private generateToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return md5(`${timestamp}_${random}`).toString();
  }

  private async makeRequest(
    action: string, 
    params: Record<string, any> = {}, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const requestToken = this.token || this.generateToken();
    
    const requestData = {
      action,
      token: requestToken,
      ...params
    };

    try {
      console.log(`GPS51 API Request: ${action}`, { url: this.baseURL, data: requestData });
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      const responseText = await response.text();
      console.log(`GPS51 API Response (${action}):`, {
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      let data: GPS51ApiResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // Handle non-JSON responses
        console.warn('Non-JSON response received:', responseText);
        data = {
          status: GPS51_STATUS.SUCCESS,
          message: responseText,
          data: responseText
        };
      }

      this.retryCount = 0;
      this.retryDelay = 1000;

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Retrying GPS51 request (${this.retryCount}/${this.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(action, params, method);
      }

      throw error;
    }
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string }> {
    try {
      console.log('Authenticating with GPS51...', { 
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type 
      });

      // Update base URL if provided
      if (credentials.apiUrl) {
        this.baseURL = credentials.apiUrl;
      }

      const response = await this.makeRequest('login', {
        username: credentials.username,
        password: credentials.password, // Should already be MD5 hashed
        from: credentials.from,
        type: credentials.type
      });

      console.log('GPS51 Login Response:', response);

      if (response.status === GPS51_STATUS.SUCCESS && response.token) {
        this.token = response.token;
        this.user = response.user || null;
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        console.log('GPS51 Authentication successful:', {
          token: this.token,
          user: this.user
        });

        return {
          success: true,
          user: this.user || undefined
        };
      } else {
        const error = response.message || `Authentication failed with status: ${response.status}`;
        console.error('GPS51 Authentication failed:', error);
        return {
          success: false,
          error
        };
      }
    } catch (error) {
      console.error('GPS51 Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  async getDeviceList(): Promise<GPS51Device[]> {
    this.ensureAuthenticated();
    
    try {
      const response = await this.makeRequest('querymonitorlist');
      console.log('GPS51 Device List Response:', response);

      if (response.status === GPS51_STATUS.SUCCESS) {
        const devices = response.data || response.devices || [];
        console.log(`Retrieved ${devices.length} devices from GPS51`);
        return Array.isArray(devices) ? devices : [];
      } else {
        throw new Error(response.message || 'Failed to fetch device list');
      }
    } catch (error) {
      console.error('Failed to get device list:', error);
      throw error;
    }
  }

  async getRealtimePositions(deviceids: string[] = [], lastQueryTime?: number): Promise<GPS51Position[]> {
    this.ensureAuthenticated();
    
    try {
      const params: any = {};
      if (deviceids.length > 0) {
        params.deviceids = deviceids.join(',');
      }
      if (lastQueryTime) {
        params.lastquerypositiontime = lastQueryTime;
      }

      const response = await this.makeRequest('lastposition', params);
      console.log('GPS51 Position Response:', response);

      if (response.status === GPS51_STATUS.SUCCESS) {
        const positions = response.data || response.positions || [];
        console.log(`Retrieved ${positions.length} positions from GPS51`);
        return Array.isArray(positions) ? positions : [];
      } else {
        throw new Error(response.message || 'Failed to fetch realtime positions');
      }
    } catch (error) {
      console.error('Failed to get realtime positions:', error);
      throw error;
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    try {
      // Try a simple API call to check if token is still valid
      const response = await this.makeRequest('querymonitorlist');
      
      if (response.status === GPS51_STATUS.SUCCESS) {
        return true;
      } else if (response.status === GPS51_STATUS.TOKEN_INVALID) {
        this.token = null;
        this.tokenExpiry = null;
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }

    return false;
  }

  private ensureAuthenticated(): void {
    if (!this.token) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      throw new Error('Token expired. Please re-authenticate.');
    }
  }

  isAuthenticated(): boolean {
    return !!(this.token && (!this.tokenExpiry || Date.now() < this.tokenExpiry));
  }

  getUser(): GPS51User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.user = null;
    this.retryCount = 0;
    this.retryDelay = 1000;
  }
}

export const gps51Client = new GPS51Client();
