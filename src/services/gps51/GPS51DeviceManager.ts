
import { GPS51Device, GPS51Group, GPS51User } from './GPS51Types';
import { GPS51_STATUS } from './GPS51Constants';
import { GPS51ApiClient } from './GPS51ApiClient';

export class GPS51DeviceManager {
  private apiClient: GPS51ApiClient;

  constructor(apiClient: GPS51ApiClient) {
    this.apiClient = apiClient;
  }

  async getDeviceList(token: string, user: GPS51User | null): Promise<GPS51Device[]> {
    try {
      console.log('=== GPS51 DEVICE LIST QUERY START ===');
      console.log('Request parameters:', {
        username: user?.username || 'unknown',
        hasToken: !!token,
        tokenLength: token?.length || 0
      });

      const response = await this.apiClient.makeRequest('querymonitorlist', token, { 
        username: user?.username || 'octopus' 
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
        hasToken: !!token,
        hasUser: !!user
      });
      throw error;
    }
  }
}
