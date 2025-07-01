
import { GPS51ApiResponse, GPS51Device, GPS51Position } from './types.ts';

export class GPS51ApiClient {
  private apiUrl: string;
  private token: string;
  private username: string;

  constructor(apiUrl: string, token: string, username: string) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.username = username;
  }

  async fetchDeviceList(): Promise<GPS51Device[]> {
    console.log("=== FETCHING DEVICE LIST ===");
    
    const deviceListPayload = {
      action: 'querymonitorlist',
      token: this.token,
      username: this.username
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceListPayload)
    });

    const responseText = await response.text();
    console.log(`Device List Response:`, {
      status: response.status,
      bodyLength: responseText.length,
      bodyPreview: responseText.substring(0, 300)
    });

    let devices: GPS51Device[] = [];
    
    if (response.ok && responseText.trim()) {
      try {
        const deviceData = JSON.parse(responseText);
        console.log('Device Data Analysis:', {
          status: deviceData.status,
          hasGroups: !!deviceData.groups,
          groupsLength: deviceData.groups?.length || 0,
          rawKeys: Object.keys(deviceData)
        });
        
        if (deviceData.status === 0 && deviceData.groups) {
          deviceData.groups.forEach((group: any) => {
            console.log(`Processing group: ${group.groupname}, devices: ${group.devices?.length || 0}`);
            if (group.devices && Array.isArray(group.devices)) {
              devices = devices.concat(group.devices);
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse device response:', e);
      }
    }

    console.log(`Device Summary: Found ${devices.length} devices`);
    return devices;
  }

  async fetchPositions(deviceIds: string[]): Promise<GPS51Position[]> {
    if (deviceIds.length === 0) {
      console.log('No device IDs provided, skipping position fetch');
      return [];
    }

    console.log("=== FETCHING POSITIONS ===");
    console.log("Position request:", {
      deviceCount: deviceIds.length,
      firstFewIds: deviceIds.slice(0, 3)
    });

    const positionPayload = {
      action: 'lastposition',
      token: this.token,
      deviceids: deviceIds,
      lastquerypositiontime: 0
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(positionPayload)
    });

    const responseText = await response.text();
    console.log(`Position Response Analysis:`, {
      status: response.status,
      statusText: response.statusText,
      bodyLength: responseText.length,
      bodyPreview: responseText.substring(0, 500),
      isEmptyOrNull: !responseText.trim() || responseText === 'null'
    });

    let positions: GPS51Position[] = [];

    if (response.ok && responseText.trim() && responseText !== 'null') {
      try {
        const positionData = JSON.parse(responseText);
        console.log('Position Data Structure Analysis:', {
          status: positionData.status,
          hasRecords: !!positionData.records,
          hasData: !!positionData.data,
          recordsLength: positionData.records?.length || 0,
          dataLength: positionData.data?.length || 0,
          responseKeys: Object.keys(positionData),
          firstRecord: positionData.records?.[0] || positionData.data?.[0] || null
        });
        
        if (positionData.status === 0) {
          if (positionData.records && Array.isArray(positionData.records)) {
            positions = positionData.records;
            console.log(`✅ Found ${positions.length} positions in 'records' field`);
          } else if (positionData.data && Array.isArray(positionData.data)) {
            positions = positionData.data;
            console.log(`✅ Found ${positions.length} positions in 'data' field`);
          } else {
            console.log('⚠️ No position array found in response');
          }
        } else {
          console.log(`❌ Position API returned error status: ${positionData.status}`);
        }
      } catch (e) {
        console.error('❌ Failed to parse position response:', e);
      }
    } else {
      console.log('⚠️ No valid position data received or null response');
    }

    console.log(`Position Summary: Found ${positions.length} positions`);
    return positions;
  }
}
