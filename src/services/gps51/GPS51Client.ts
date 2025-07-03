import { GPS51AuthCredentials, GPS51User, GPS51Device, GPS51Position, GPS51Group, GPS51ApiResponse } from './GPS51Types';
import { GPS51_STATUS, GPS51_DEFAULTS } from './GPS51Constants';
import { GPS51Utils } from './GPS51Utils';
import { GPS51ApiClient } from './GPS51ApiClient';

export class GPS51Client {
  private apiClient: GPS51ApiClient;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private user: GPS51User | null = null;

  constructor(baseURL = GPS51_DEFAULTS.BASE_URL) {
    this.apiClient = new GPS51ApiClient(baseURL);
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string }> {
    try {
      console.log('GPS51 Authentication Debug Info:', { 
        username: credentials.username,
        passwordProvided: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        isPasswordMD5: GPS51Utils.validateMD5Hash(credentials.password || ''),
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type 
      });

      if (!GPS51Utils.validateMD5Hash(credentials.password)) {
        console.warn('Password does not appear to be a valid MD5 hash. Expected 32 lowercase hex characters.');
        console.log('Password validation details:', GPS51Utils.getPasswordValidationInfo(credentials.password));
      }

      if (credentials.apiUrl) {
        const normalizedUrl = GPS51Utils.normalizeApiUrl(credentials.apiUrl);
        this.apiClient.setBaseURL(normalizedUrl);
      }

      const loginParams = {
        username: credentials.username,
        password: credentials.password,
        from: credentials.from,
        type: credentials.type
      };

      console.log('Sending GPS51 login request with corrected parameters:', {
        method: 'POST',
        loginParams,
        parameterValidation: {
          usernameLength: loginParams.username.length,
          passwordIsMD5: GPS51Utils.validateMD5Hash(loginParams.password),
          fromValue: loginParams.from,
          typeValue: loginParams.type,
          allRequiredPresent: !!(loginParams.username && loginParams.password && loginParams.from && loginParams.type)
        }
      });

      const requestToken = GPS51Utils.generateToken();
      const response = await this.apiClient.makeRequest('login', requestToken, loginParams, 'POST');

      console.log('GPS51 Login Response Analysis:', {
        status: response.status,
        message: response.message,
        cause: response.cause,
        hasToken: !!response.token,
        hasUser: !!response.user,
        tokenLength: response.token?.length || 0,
        userInfo: response.user ? {
          username: response.user.username,
          usertype: response.user.usertype,
          companyname: response.user.companyname
        } : null
      });

      if (response.status === GPS51_STATUS.SUCCESS && response.token) {
        this.token = response.token;
        this.user = response.user || null;
        this.tokenExpiry = Date.now() + (GPS51_DEFAULTS.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
        
        console.log('GPS51 Authentication successful:', {
          token: this.token,
          user: this.user
        });

        return {
          success: true,
          user: this.user || undefined
        };
      } else {
        const errorDetails = {
          status: response.status,
          message: response.message,
          cause: response.cause,
          expectedStatus: GPS51_STATUS.SUCCESS,
          hasToken: !!response.token,
          rawResponse: response
        };
        
        console.error('GPS51 Authentication failed - detailed analysis:', errorDetails);
        
        let errorMessage = response.message || response.cause || `Authentication failed with status: ${response.status}`;
        
        if (response.status === 8901) {
          errorMessage += ' (Status 8901: Authentication parameter validation failed - check username, password hash, from, and type parameters)';
        } else if (response.status === 1) {
          errorMessage += ' (Status 1: Login failed - verify credentials and account status)';
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('GPS51 Authentication exception:', {
        error: error.message,
        stack: error.stack,
        credentials: {
          username: credentials.username,
          hasPassword: !!credentials.password,
          apiUrl: credentials.apiUrl,
          from: credentials.from,
          type: credentials.type
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  async getDeviceList(): Promise<GPS51Device[]> {
    this.ensureAuthenticated();
    
    try {
      console.log('=== GPS51 DEVICE LIST QUERY START ===');
      console.log('Request parameters:', {
        username: this.user?.username || 'unknown',
        hasToken: !!this.token,
        tokenLength: this.token?.length || 0
      });

      const response = await this.apiClient.makeRequest('querymonitorlist', this.token!, { 
        username: this.user?.username || 'octopus' 
      });
      
      console.log('GPS51 Device List Response Analysis:', {
        status: response.status,
        statusType: typeof response.status,
        message: response.message,
        cause: response.cause,
        hasGroups: !!response.groups,
        groupsLength: Array.isArray(response.groups) ? response.groups.length : 0,
        hasData: !!response.data,
        hasDevices: !!response.devices,
        responseKeys: Object.keys(response)
      });

      if (response.status === GPS51_STATUS.SUCCESS || response.status === '0' || response.status === 0) {
        let devices: GPS51Device[] = [];
        
        if (response.groups && Array.isArray(response.groups)) {
          console.log(`Processing ${response.groups.length} device groups`);
          
          response.groups.forEach((group: GPS51Group, index: number) => {
            console.log(`Group ${index + 1}: ${group.groupname}`, {
              groupId: group.groupid,
              devicesCount: group.devices?.length || 0,
              hasRemark: !!group.remark,
              deviceIds: group.devices?.map(d => d.deviceid) || []
            });
            
            if (group.devices && Array.isArray(group.devices)) {
              const validatedDevices = group.devices.map((device: GPS51Device) => {
                console.log(`Device validation:`, {
                  deviceid: device.deviceid,
                  devicename: device.devicename,
                  devicetype: device.devicetype,
                  hasAllFields: !!(device.deviceid && device.devicename),
                  lastactivetime: device.lastactivetime,
                  isActiveRecently: device.lastactivetime ? (Date.now() - device.lastactivetime < 30 * 60 * 1000) : false,
                  extraFields: {
                    hasOverdueTime: !!device.overduetime,
                    hasRemark: !!device.remark,
                    hasCreater: !!device.creater,
                    hasVideoChannelCount: device.videochannelcount !== undefined
                  }
                });
                
                return device;
              });
              
              devices = devices.concat(validatedDevices);
            }
          });
        } else if (response.data || response.devices) {
          const fallbackDevices = response.data || response.devices || [];
          console.log('Using fallback device format:', {
            deviceCount: Array.isArray(fallbackDevices) ? fallbackDevices.length : 0,
            isArray: Array.isArray(fallbackDevices)
          });
          devices = Array.isArray(fallbackDevices) ? fallbackDevices : [];
        }
        
        console.log(`=== GPS51 DEVICE LIST QUERY SUCCESS ===`);
        console.log(`Retrieved ${devices.length} devices total`);
        
        // Enhanced device analysis for live data troubleshooting
        const activeDevices = devices.filter(d => d.lastactivetime && (Date.now() - d.lastactivetime < 30 * 60 * 1000));
        const recentlyActiveDevices = devices.filter(d => d.lastactivetime && (Date.now() - d.lastactivetime < 2 * 60 * 60 * 1000));
        
        console.log('Device activity analysis:', {
          totalDevices: devices.length,
          devicesWithLastActiveTime: devices.filter(d => d.lastactivetime).length,
          activeDevices: activeDevices.length,
          recentlyActiveDevices: recentlyActiveDevices.length,
          deviceTypes: [...new Set(devices.map(d => d.devicetype))],
          devicesWithVideoChannels: devices.filter(d => d.videochannelcount && d.videochannelcount > 0).length
        });
        
        return devices;
      } else {
        const errorMessage = response.cause || response.message || `Failed to fetch device list - Status: ${response.status}`;
        console.error('GPS51 Device List Error:', {
          status: response.status,
          message: response.message,
          cause: response.cause,
          fullResponse: response
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('=== GPS51 DEVICE LIST QUERY ERROR ===');
      console.error('Failed to get device list:', {
        error: error.message,
        stack: error.stack,
        hasToken: !!this.token,
        hasUser: !!this.user
      });
      throw error;
    }
  }

  async getRealtimePositions(deviceids: string[] = [], lastQueryTime?: number): Promise<{positions: GPS51Position[], lastQueryTime: number}> {
    this.ensureAuthenticated();
    
    try {
      // CRITICAL FIX: Handle lastquerypositiontime correctly
      // For first call: use 0 or omit to get all available positions
      // For subsequent calls: use the server's lastquerypositiontime from previous response
      const params: any = {
        deviceids: deviceids.length > 0 ? deviceids.join(',') : ''
      };

      // Only add lastquerypositiontime if we have a valid value from previous server response
      if (lastQueryTime !== undefined && lastQueryTime > 0) {
        params.lastquerypositiontime = lastQueryTime;
      } else {
        // First call - omit parameter to get all available positions
        console.log('GPS51 Position Request: First call - omitting lastquerypositiontime to get all available positions');
      }

      console.log('GPS51 Position Request Parameters (FIXED):', {
        deviceidsCount: params.deviceids.length,
        deviceids: params.deviceids.slice(0, 5), // Log first 5 for debugging
        lastQueryTime: params.lastquerypositiontime,
        isFirstCall: !params.lastquerypositiontime,
        requestType: params.lastquerypositiontime ? 'incremental' : 'initial'
      });

      const response = await this.apiClient.makeRequest('lastposition', this.token!, params);
      
      console.log('GPS51 Position Response Analysis (FIXED):', {
        status: response.status,
        cause: response.cause,
        hasRecords: !!response.records,
        recordsLength: Array.isArray(response.records) ? response.records.length : 0,
        serverLastQueryTime: response.lastquerypositiontime,
        serverTimestamp: response.lastquerypositiontime ? new Date(response.lastquerypositiontime).toISOString() : 'N/A',
        responseKeys: Object.keys(response)
      });

      if (response.status === GPS51_STATUS.SUCCESS) {
        let positions: GPS51Position[] = [];
        
        if (response.records && Array.isArray(response.records)) {
          positions = response.records;
          console.log(`GPS51 POSITION SUCCESS: Retrieved ${positions.length} positions from records field`);
        } else if (response.data && Array.isArray(response.data)) {
          positions = response.data;
          console.log(`GPS51 POSITION SUCCESS: Retrieved ${positions.length} positions from data field`);
        } else if (response.positions && Array.isArray(response.positions)) {
          positions = response.positions;
          console.log(`GPS51 POSITION SUCCESS: Retrieved ${positions.length} positions from positions field`);
        } else {
          console.warn('GPS51 POSITION WARNING: No position data found in response:', {
            hasRecords: !!response.records,
            hasData: !!response.data,
            hasPositions: !!response.positions,
            responseKeys: Object.keys(response)
          });
        }
        
        // CRITICAL FIX: Return the server's lastquerypositiontime for next call
        const serverLastQueryTime = response.lastquerypositiontime || lastQueryTime || 0;
        
        console.log('GPS51 Position Final Result:', {
          positionsRetrieved: positions.length,
          serverLastQueryTime,
          nextCallTimestamp: serverLastQueryTime ? new Date(serverLastQueryTime).toISOString() : 'N/A'
        });
        
        return {
          positions,
          lastQueryTime: serverLastQueryTime
        };
      } else {
        const errorMessage = response.message || response.cause || 'Failed to fetch realtime positions';
        console.error('GPS51 Position API Error:', {
          status: response.status,
          message: response.message,
          cause: response.cause,
          fullResponse: response
        });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('GPS51 Position Request Failed:', {
        error: error.message,
        stack: error.stack,
        deviceCount: deviceids.length,
        lastQueryTime,
        hasToken: !!this.token
      });
      throw error;
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    try {
      const response = await this.apiClient.makeRequest('querymonitorlist', this.token!, { username: this.user.username });
      
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
    this.apiClient.resetRetryState();
  }
}

export const gps51Client = new GPS51Client();

// Re-export types for convenience
export type { GPS51AuthCredentials, GPS51User, GPS51Device, GPS51Position, GPS51Group, GPS51ApiResponse } from './GPS51Types';
