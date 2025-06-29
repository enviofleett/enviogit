
import { GPS51ApiClient } from './GPS51ApiClient';
import { GPS51AuthenticationClient } from './GPS51AuthenticationClient';
import { GPS51_STATUS } from './GPS51ApiEndpoints';

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

// ==================== MAIN GPS51 CLIENT ====================

export class GPS51Client {
  private apiClient: GPS51ApiClient;
  private authClient: GPS51AuthenticationClient;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private user: GPS51User | null = null;
  private endpointTokens: Map<string, { token: string; expiry: Date }> = new Map();

  constructor(baseURL = 'https://api.gps51.com/openapi') {
    this.apiClient = new GPS51ApiClient(baseURL);
    this.authClient = new GPS51AuthenticationClient();
  }

  private validateMD5Hash(password: string): boolean {
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string; access_token?: string }> {
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
      this.apiClient.setBaseURL(credentials.apiUrl);

      const result = await this.authClient.authenticateEndpoint(endpointType, credentials);

      if (result.success && result.token) {
        this.token = result.token;
        this.user = result.user || null;
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        this.apiClient.setToken(this.token);
        
        console.log('GPS51 Authentication successful');
        return {
          success: true,
          user: this.user || undefined,
          access_token: result.token // Return the token as access_token for backward compatibility
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
      const response = await this.apiClient.makeRequest('querymonitorlist', { username: this.user?.username || 'octopus' });
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

      const response = await this.apiClient.makeRequest('lastposition', params);
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

  async refreshToken(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    try {
      const response = await this.apiClient.makeRequest('querymonitorlist', { username: this.user.username });
      
      if (response.status === GPS51_STATUS.SUCCESS) {
        return true;
      } else if (response.status === GPS51_STATUS.TOKEN_INVALID) {
        this.token = null;
        this.tokenExpiry = null;
        this.apiClient.setToken(null);
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

  async getValidToken(): Promise<{ access_token: string } | null> {
    if (this.isAuthenticated() && this.token) {
      return { access_token: this.token };
    }
    return null;
  }

  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.user = null;
    this.endpointTokens.clear();
    this.apiClient.setToken(null);
  }
}

export const gps51Client = new GPS51Client();
