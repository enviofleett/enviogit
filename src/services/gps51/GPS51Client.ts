
import { md5 } from 'js-md5';

// ==================== TYPE DEFINITIONS ====================

export interface GPS51AuthCredentials {
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
  apiUrl: string;
  apiKey?: string;
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
  callat?: number;
  callon?: number;
  speed?: number;
  course?: number;
  updatetime?: number;
  status?: number;
  moving?: number;
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
}

export interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
  user?: GPS51User;
  devices?: GPS51Device[];
  positions?: GPS51Position[];
  groups?: GPS51Group[];
  records?: GPS51Position[];
  lastquerypositiontime?: number;
}

export interface GPS51Group {
  groupid: number;
  groupname: string;
  remark?: string;
  shared: number;
  devices: GPS51Device[];
}

// ==================== API ENDPOINT CONFIGURATION ====================

interface GPS51ApiEndpoints {
  standard: {
    baseUrl: string;
    name: string;
    features: string[];
  };
  openapi: {
    baseUrl: string;
    name: string;
    features: string[];
  };
}

const GPS51_ENDPOINTS: GPS51ApiEndpoints = {
  standard: {
    baseUrl: 'https://www.gps51.com/webapi',
    name: 'Standard Web API',
    features: ['Basic device management', 'Standard authentication', 'Legacy support']
  },
  openapi: {
    baseUrl: 'https://api.gps51.com/openapi',
    name: 'OpenAPI (RESTful)',
    features: ['Modern REST API', 'Better error handling', 'Enhanced data format', 'Improved performance']
  }
};

const GPS51_STATUS = {
  SUCCESS: 0,
  FAILED: 1,
  PASSWORD_ERROR: 1,
  OFFLINE_NOT_CACHE: 2,
  OFFLINE_CACHED: 3,
  TOKEN_INVALID: 4,
  NO_PERMISSION: 5,
} as const;

// ==================== MULTI-ENDPOINT GPS51 CLIENT ====================

export class GPS51Client {
  private baseURL: string;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private user: GPS51User | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  private preferredEndpoint: 'standard' | 'openapi' | 'auto' = 'auto';
  private endpointTokens: Map<string, { token: string; expiry: Date }> = new Map();

  constructor(baseURL = 'https://api.gps51.com/openapi') {
    this.baseURL = baseURL;
  }

  private generateToken(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private validateMD5Hash(password: string): boolean {
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  // ==================== AUTHENTICATION FOR BOTH ENDPOINTS ====================

  async authenticateEndpoint(endpointType: 'standard' | 'openapi', credentials: GPS51AuthCredentials): Promise<{
    success: boolean;
    token?: string;
    user?: GPS51User;
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
        // Store token with expiry
        this.endpointTokens.set(endpointType, {
          token: result.token,
          expiry: new Date(Date.now() + 23 * 60 * 60 * 1000) // 23 hours
        });
        
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

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string }> {
    try {
      console.log('GPS51 Authentication Debug Info:', { 
        username: credentials.username,
        passwordProvided: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        isPasswordMD5: this.validateMD5Hash(credentials.password || ''),
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type 
      });

      // Determine endpoint type from URL
      let endpointType: 'standard' | 'openapi' = 'openapi';
      if (credentials.apiUrl.includes('webapi')) {
        endpointType = 'standard';
      }

      // Set the baseURL for this instance
      this.baseURL = credentials.apiUrl;

      const result = await this.authenticateEndpoint(endpointType, credentials);

      if (result.success && result.token) {
        this.token = result.token;
        this.user = result.user || null;
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        console.log('GPS51 Authentication successful');
        return {
          success: true,
          user: this.user || undefined
        };
      } else {
        console.error('GPS51 Authentication failed:', result.error);
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('GPS51 Authentication exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  async getDeviceList(): Promise<GPS51Device[]> {
    this.ensureAuthenticated();
    
    try {
      const response = await this.makeRequest('querymonitorlist', { username: this.user?.username || 'octopus' });
      console.log('GPS51 Device List Response:', response);

      if (response.status === GPS51_STATUS.SUCCESS) {
        let devices: GPS51Device[] = [];
        
        if (response.groups && Array.isArray(response.groups)) {
          console.log(`Processing ${response.groups.length} device groups`);
          
          response.groups.forEach((group: GPS51Group) => {
            console.log(`Group: ${group.groupname}, devices: ${group.devices?.length || 0}`);
            
            if (group.devices && Array.isArray(group.devices)) {
              devices = devices.concat(group.devices);
            }
          });
        } else if (response.data || response.devices) {
          devices = response.data || response.devices || [];
        }
        
        console.log(`Retrieved ${devices.length} devices from GPS51 groups format`);
        return devices;
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
      const params: any = {
        deviceids: deviceids.length > 0 ? deviceids : [],
        lastquerypositiontime: lastQueryTime || 0
      };

      console.log('GPS51 Position Request Parameters:', {
        deviceidsCount: params.deviceids.length,
        deviceids: params.deviceids,
        lastQueryTime: params.lastquerypositiontime
      });

      const response = await this.makeRequest('lastposition', params);
      console.log('GPS51 Position Response:', response);

      if (response.status === GPS51_STATUS.SUCCESS) {
        let positions: GPS51Position[] = [];
        
        if (response.records && Array.isArray(response.records)) {
          positions = response.records;
          console.log(`Retrieved ${positions.length} positions from records field`);
        } else if (response.data && Array.isArray(response.data)) {
          positions = response.data;
          console.log(`Retrieved ${positions.length} positions from data field`);
        } else if (response.positions && Array.isArray(response.positions)) {
          positions = response.positions;
          console.log(`Retrieved ${positions.length} positions from positions field`);
        } else {
          console.warn('No position data found in response:', {
            hasRecords: !!response.records,
            hasData: !!response.data,
            hasPositions: !!response.positions,
            responseKeys: Object.keys(response)
          });
        }
        
        return positions;
      } else {
        throw new Error(response.message || 'Failed to fetch realtime positions');
      }
    } catch (error) {
      console.error('Failed to get realtime positions:', error);
      throw error;
    }
  }

  private async makeRequest(
    action: string, 
    params: Record<string, any> = {}, 
    method: 'GET' | 'POST' = 'POST'
  ): Promise<GPS51ApiResponse> {
    const requestToken = this.generateToken();
    
    const url = new URL(this.baseURL);
    url.searchParams.append('action', action);
    url.searchParams.append('token', requestToken);

    try {
      console.log(`GPS51 API Request: ${action}`, { 
        url: url.toString(), 
        method,
        params,
        baseURL: this.baseURL,
        ...(action === 'login' && params.password ? {
          passwordValidation: {
            isValidMD5: this.validateMD5Hash(params.password),
            passwordLength: params.password.length,
          }
        } : {})
      });
      
      const requestOptions: RequestInit = {
        method: method,
        headers: {
          'Accept': 'application/json',
        }
      };

      if (method === 'POST' && Object.keys(params).length > 0) {
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json',
        };
        
        // Add Authorization header if we have a token and this isn't a login request
        if (this.token && action !== 'login') {
          requestOptions.headers = {
            ...requestOptions.headers,
            'Authorization': `Bearer ${this.token}`,
          };
        }
        
        requestOptions.body = JSON.stringify(params);
        
        console.log('GPS51 POST Request Details:', {
          url: url.toString(),
          method: 'POST',
          headers: requestOptions.headers,
          bodyObject: params
        });
      }
      
      const response = await fetch(url.toString(), requestOptions);
      
      const responseText = await response.text();
      console.log(`GPS51 API Raw Response (${action}):`, {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        rawBody: responseText,
        bodyLength: responseText.length,
        isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${responseText}`);
      }

      let data: GPS51ApiResponse;
      try {
        data = JSON.parse(responseText);
        console.log(`GPS51 API Parsed Response (${action}):`, {
          status: data.status,
          message: data.message,
          hasToken: !!data.token,
          hasUser: !!data.user,
          hasData: !!data.data,
          hasGroups: !!data.groups,
          hasRecords: !!data.records,
          dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
        });
      } catch (parseError) {
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
      console.error(`GPS51 API Error (${action}):`, {
        error: error.message,
        url: url.toString(),
        params,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      if (this.retryCount < this.maxRetries && 
          (error.message.includes('network') || error.message.includes('timeout'))) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
        
        console.log(`Retrying GPS51 request (${this.retryCount}/${this.maxRetries}) after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(action, params, method);
      }

      throw error;
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    try {
      const response = await this.makeRequest('querymonitorlist', { username: this.user.username });
      
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

  async getValidToken(): Promise<any> {
    if (this.isAuthenticated() && this.token) {
      return { access_token: this.token };
    }
    return null;
  }

  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.user = null;
    this.retryCount = 0;
    this.retryDelay = 1000;
    this.endpointTokens.clear();
  }
}

export const gps51Client = new GPS51Client();
