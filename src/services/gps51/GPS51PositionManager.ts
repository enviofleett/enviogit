
import { GPS51Position } from './GPS51Types';
import { GPS51_STATUS } from './GPS51Constants';
import { GPS51ApiClient } from './GPS51ApiClient';

export interface GPS51PositionResult {
  positions: GPS51Position[];
  lastQueryTime: number;
}

export class GPS51PositionManager {
  private apiClient: GPS51ApiClient;

  constructor(apiClient: GPS51ApiClient) {
    this.apiClient = apiClient;
  }

  async getRealtimePositions(token: string, deviceids: string[] = [], lastQueryTime?: number): Promise<GPS51PositionResult> {
    try {
      // CRITICAL FIX: Handle lastquerypositiontime correctly
      // For first call: use 0 or omit to get all available positions
      // For subsequent calls: use the server's lastquerypositiontime from previous response
      const params: any = {
        deviceids: deviceids.length > 0 ? deviceids : []
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

      const response = await this.apiClient.makeRequest('lastposition', token, params);
      
      console.log('GPS51 Position Response Analysis (FIXED):', {
        status: response.status,
        cause: response.cause,
        hasRecords: !!response.records,
        recordsLength: Array.isArray(response.records) ? response.records.length : 0,
        serverLastQueryTime: response.lastquerypositiontime,
        serverTimestamp: new Date(response.lastquerypositiontime).toISOString(),
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
          nextCallTimestamp: new Date(serverLastQueryTime).toISOString()
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
        hasToken: !!token
      });
      throw error;
    }
  }
}
