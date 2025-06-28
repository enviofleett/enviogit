
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
  // Real-time location data
  callat: number; // latitude
  callon: number; // longitude
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
  callat: number; // calculated latitude
  callon: number; // calculated longitude
  altitude: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  updatetime: number;
  // Additional sensor data
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
  radius?: number;
  gotsrc?: string;
  rxlevel?: number;
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
  private retryDelay = 1000; // Start with 1 second

  constructor(baseURL = 'https://api.gps51.com/webapi') {
    this.baseURL = baseURL;
  }

  private generateToken(): string {
    // Generate a unique token for the request
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return md5(`${timestamp}_${random}`);
  }

  private encryptPassword(password: string): string {
    return md5(password).toLowerCase();
  }

  private async makeRequest(
    action: string, 
    params: Record<string, any> = {}, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const requestToken = this.token || this.generateToken();
    const url = new URL(this.baseURL);
    
    // Add action and token to URL parameters
    url.searchParams.set('action', action);
    url.searchParams.set('token', requestToken);
    
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (method === 'POST' && Object.keys(params).length > 0) {
      requestOptions.body = JSON.stringify(params);
    } else if (method === 'GET') {
      // Add params to URL for GET requests
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    try {
      console.log(`GPS51 API Request: ${action}`, { url: url.toString(), params });
      
      const response = await fetch(url.toString(), requestOptions);
      const responseText = await response.text();
      
      console.log(`GPS51 API Response (${action}):`, {
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        body: responseText
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      // Try to parse as JSON
      let data: GPS51ApiResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // If not JSON, wrap in our response format
        data = {
          status: GPS51_STATUS.SUCCESS,
          message: responseText,
          data: responseText
        };
      }

      // Reset retry count on successful request
      this.retryCount = 0;
      this.retryDelay = 1000;

      return data;
    } catch (error) {
      console.error(`GPS51 API Error (${action}):`, error);
      
      // Implement exponential backoff retry logic
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
      const encryptedPassword = this.encryptPassword(credentials.password);
      
      const response = await this.makeRequest('login', {
        username: credentials.username,
        password: encryptedPassword,
        from: credentials.from,
        type: credentials.type
      });

      if (response.status === GPS51_STATUS.SUCCESS && response.token) {
        this.token = response.token;
        this.user = response.user || null;
        
        // Set token expiry (assuming 24 hours if not provided)
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
        
        console.log('GPS51 Authentication successful:', {
          token: this.token,
          user: this.user
        });

        return {
          success: true,
          user: this.user || undefined
        };
      } else {
        return {
          success: false,
          error: response.message || 'Authentication failed'
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

  async getDeviceTree(extend = 'self', serverid = 0): Promise<GPS51Device[]> {
    this.ensureAuthenticated();
    
    const response = await this.makeRequest('querydevicestree', {
      extend,
      serverid
    }, 'GET');

    if (response.status === GPS51_STATUS.SUCCESS) {
      return response.devices || response.data || [];
    } else {
      throw new Error(response.message || 'Failed to fetch device tree');
    }
  }

  async getDeviceList(): Promise<GPS51Device[]> {
    this.ensureAuthenticated();
    
    const response = await this.makeRequest('querymonitorlist');

    if (response.status === GPS51_STATUS.SUCCESS) {
      return response.devices || response.data || [];
    } else {
      throw new Error(response.message || 'Failed to fetch device list');
    }
  }

  async getRealtimePositions(deviceids: string[] = [], lastQueryTime?: number): Promise<GPS51Position[]> {
    this.ensureAuthenticated();
    
    const params: any = {};
    if (deviceids.length > 0) {
      params.deviceids = deviceids.join(',');
    }
    if (lastQueryTime) {
      params.lastquerypositiontime = lastQueryTime;
    }

    const response = await this.makeRequest('lastposition', params);

    if (response.status === GPS51_STATUS.SUCCESS) {
      return response.positions || response.data || [];
    } else {
      throw new Error(response.message || 'Failed to fetch realtime positions');
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    try {
      // Attempt to refresh by making a simple API call
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

    // Check if token is expired
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
