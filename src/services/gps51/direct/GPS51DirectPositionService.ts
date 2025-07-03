import { GPS51Position } from '../GPS51Types';
import { GPS51DirectAuthService } from './GPS51DirectAuthService';
import { GPS51EnhancedApiClient } from './GPS51EnhancedApiClient';
import { GPS51_STATUS } from '../GPS51Constants';

export interface PositionServiceOptions {
  enableFiltering?: boolean;
  maxPositionAge?: number; // seconds
  coordinateValidation?: boolean;
  adaptivePolling?: boolean;
}

export interface PositionQueryResult {
  positions: GPS51Position[];
  lastQueryTime: number;
  serverTimestamp: number;
  hasNewData: boolean;
  filteredCount: number;
  totalReceived: number;
}

export interface PositionFilter {
  deviceIds?: string[];
  maxAge?: number;
  validCoordinatesOnly?: boolean;
  excludeStationary?: boolean;
  minAccuracy?: number;
}

export interface PollingState {
  isActive: boolean;
  interval: number;
  lastPollTime: number;
  consecutiveEmptyResponses: number;
  adaptiveInterval: number;
}

export class GPS51DirectPositionService {
  private authService: GPS51DirectAuthService;
  private apiClient: GPS51EnhancedApiClient;
  private options: Required<PositionServiceOptions>;
  private lastQueryPositionTime = 0;
  private pollingState: PollingState;
  private positionHistory = new Map<string, GPS51Position[]>();
  private maxHistorySize = 100;

  constructor(
    authService: GPS51DirectAuthService,
    options: PositionServiceOptions = {}
  ) {
    this.authService = authService;
    this.apiClient = new GPS51EnhancedApiClient();
    this.options = {
      enableFiltering: true,
      maxPositionAge: 3600, // 1 hour
      coordinateValidation: true,
      adaptivePolling: true,
      ...options
    };

    this.pollingState = {
      isActive: false,
      interval: 30000, // 30 seconds default
      lastPollTime: 0,
      consecutiveEmptyResponses: 0,
      adaptiveInterval: 30000
    };
  }

  async getRealtimePositions(
    deviceIds: string[] = [],
    filter: PositionFilter = {}
  ): Promise<PositionQueryResult> {
    // Ensure authentication
    if (!this.authService.isAuthenticated()) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No valid authentication token');
    }

    try {
      console.log('GPS51DirectPositionService: Fetching realtime positions...', {
        deviceCount: deviceIds.length,
        lastQueryTime: this.lastQueryPositionTime,
        filter
      });

      // Prepare request parameters
      const params: any = {};
      
      if (deviceIds.length > 0) {
        params.deviceids = deviceIds.join(',');
      }

      // Only include lastquerypositiontime if we have a valid previous timestamp
      if (this.lastQueryPositionTime > 0) {
        params.lastquerypositiontime = this.lastQueryPositionTime;
      }

      const response = await this.apiClient.makeAuthenticatedRequest(
        'lastposition',
        params,
        'POST',
        token,
        { priority: 'high' }
      );

      return this.processPositionResponse(response, filter);

    } catch (error) {
      console.error('GPS51DirectPositionService: Failed to fetch positions:', error);
      
      // Update polling state on error
      this.pollingState.consecutiveEmptyResponses++;
      this.updateAdaptiveInterval();
      
      throw error;
    }
  }

  private processPositionResponse(
    response: any,
    filter: PositionFilter
  ): PositionQueryResult {
    const now = Date.now();
    
    console.log('GPS51DirectPositionService: Processing position response:', {
      status: response.status,
      hasRecords: !!response.records,
      recordsLength: Array.isArray(response.records) ? response.records.length : 0,
      serverTimestamp: response.lastquerypositiontime
    });

    if (response.status !== GPS51_STATUS.SUCCESS) {
      throw new Error(
        response.cause || response.message || `Position API returned status: ${response.status}`
      );
    }

    // Extract positions from response
    let rawPositions: GPS51Position[] = [];
    
    if (response.records && Array.isArray(response.records)) {
      rawPositions = response.records;
    } else if (response.data && Array.isArray(response.data)) {
      rawPositions = response.data;
    } else if (response.positions && Array.isArray(response.positions)) {
      rawPositions = response.positions;
    }

    const totalReceived = rawPositions.length;

    // Apply filtering
    const filteredPositions = this.options.enableFiltering 
      ? this.filterPositions(rawPositions, filter)
      : rawPositions;

    const filteredCount = rawPositions.length - filteredPositions.length;
    const hasNewData = filteredPositions.length > 0;

    // Update last query time from server response
    const serverTimestamp = response.lastquerypositiontime || this.lastQueryPositionTime || now;
    this.lastQueryPositionTime = serverTimestamp;

    // Update polling state
    if (hasNewData) {
      this.pollingState.consecutiveEmptyResponses = 0;
    } else {
      this.pollingState.consecutiveEmptyResponses++;
    }
    this.updateAdaptiveInterval();

    // Store positions in history
    this.updatePositionHistory(filteredPositions);

    console.log('GPS51DirectPositionService: Position processing complete:', {
      totalReceived,
      filteredOut: filteredCount,
      finalCount: filteredPositions.length,
      hasNewData,
      serverTimestamp,
      consecutiveEmpty: this.pollingState.consecutiveEmptyResponses
    });

    return {
      positions: filteredPositions,
      lastQueryTime: this.lastQueryPositionTime,
      serverTimestamp,
      hasNewData,
      filteredCount,
      totalReceived
    };
  }

  private filterPositions(positions: GPS51Position[], filter: PositionFilter): GPS51Position[] {
    const now = Date.now() / 1000; // Convert to seconds for comparison
    const maxAge = filter.maxAge || this.options.maxPositionAge;

    return positions.filter(position => {
      // Device ID filter
      if (filter.deviceIds && filter.deviceIds.length > 0) {
        if (!filter.deviceIds.includes(position.deviceid)) {
          return false;
        }
      }

      // Age filter
      if (maxAge > 0) {
        const positionAge = now - position.updatetime;
        if (positionAge > maxAge) {
          console.debug('GPS51DirectPositionService: Filtered out old position:', {
            deviceId: position.deviceid,
            age: positionAge,
            maxAge
          });
          return false;
        }
      }

      // Coordinate validation
      if (filter.validCoordinatesOnly && this.options.coordinateValidation) {
        if (!this.isValidCoordinate(position.callat, position.callon)) {
          console.debug('GPS51DirectPositionService: Filtered out invalid coordinates:', {
            deviceId: position.deviceid,
            lat: position.callat,
            lon: position.callon
          });
          return false;
        }
      }

      // Stationary filter
      if (filter.excludeStationary) {
        if (position.speed !== undefined && position.speed < 1) {
          return false;
        }
      }

      // Accuracy filter (if GPS accuracy data is available)
      if (filter.minAccuracy && position.radius !== undefined) {
        if (position.radius > filter.minAccuracy) {
          return false;
        }
      }

      return true;
    });
  }

  private isValidCoordinate(lat: number, lon: number): boolean {
    return !isNaN(lat) && !isNaN(lon) && 
           lat >= -90 && lat <= 90 && 
           lon >= -180 && lon <= 180 &&
           !(lat === 0 && lon === 0); // Exclude null island
  }

  private updatePositionHistory(positions: GPS51Position[]): void {
    positions.forEach(position => {
      const deviceId = position.deviceid;
      
      if (!this.positionHistory.has(deviceId)) {
        this.positionHistory.set(deviceId, []);
      }

      const history = this.positionHistory.get(deviceId)!;
      history.push(position);

      // Keep only recent positions
      if (history.length > this.maxHistorySize) {
        history.splice(0, history.length - this.maxHistorySize);
      }

      // Sort by timestamp
      history.sort((a, b) => b.updatetime - a.updatetime);
    });
  }

  private updateAdaptiveInterval(): void {
    if (!this.options.adaptivePolling) return;

    const baseInterval = 30000; // 30 seconds
    const maxInterval = 300000; // 5 minutes
    const emptyResponseCount = this.pollingState.consecutiveEmptyResponses;

    if (emptyResponseCount === 0) {
      // Fast polling when we have data
      this.pollingState.adaptiveInterval = baseInterval;
    } else if (emptyResponseCount < 3) {
      // Slightly slower
      this.pollingState.adaptiveInterval = baseInterval * 1.5;
    } else if (emptyResponseCount < 6) {
      // Moderate slowdown
      this.pollingState.adaptiveInterval = baseInterval * 3;
    } else {
      // Slow polling when no data
      this.pollingState.adaptiveInterval = Math.min(
        baseInterval * Math.pow(2, Math.min(emptyResponseCount - 5, 4)),
        maxInterval
      );
    }

    console.log('GPS51DirectPositionService: Adaptive interval updated:', {
      consecutiveEmpty: emptyResponseCount,
      newInterval: this.pollingState.adaptiveInterval
    });
  }

  // Position history and analysis
  getPositionHistory(deviceId: string, limit = 10): GPS51Position[] {
    const history = this.positionHistory.get(deviceId) || [];
    return history.slice(0, limit);
  }

  getLatestPosition(deviceId: string): GPS51Position | null {
    const history = this.positionHistory.get(deviceId);
    return history && history.length > 0 ? history[0] : null;
  }

  // Polling management
  getPollingState(): PollingState {
    return { ...this.pollingState };
  }

  resetPollingState(): void {
    this.pollingState.consecutiveEmptyResponses = 0;
    this.pollingState.adaptiveInterval = 30000;
    this.lastQueryPositionTime = 0;
    console.log('GPS51DirectPositionService: Polling state reset');
  }

  // Statistics and monitoring
  getServiceStats(): {
    totalDevicesTracked: number;
    averagePositionsPerDevice: number;
    oldestPosition: number;
    newestPosition: number;
    pollingEfficiency: number;
  } {
    const deviceCount = this.positionHistory.size;
    let totalPositions = 0;
    let oldestTime = Infinity;
    let newestTime = 0;

    this.positionHistory.forEach(positions => {
      totalPositions += positions.length;
      
      if (positions.length > 0) {
        const oldest = Math.min(...positions.map(p => p.updatetime));
        const newest = Math.max(...positions.map(p => p.updatetime));
        
        oldestTime = Math.min(oldestTime, oldest);
        newestTime = Math.max(newestTime, newest);
      }
    });

    const averagePositions = deviceCount > 0 ? totalPositions / deviceCount : 0;
    const pollingEfficiency = this.pollingState.consecutiveEmptyResponses === 0 ? 100 : 
      Math.max(0, 100 - (this.pollingState.consecutiveEmptyResponses * 10));

    return {
      totalDevicesTracked: deviceCount,
      averagePositionsPerDevice: Math.round(averagePositions * 100) / 100,
      oldestPosition: oldestTime === Infinity ? 0 : oldestTime,
      newestPosition: newestTime,
      pollingEfficiency: Math.round(pollingEfficiency * 100) / 100
    };
  }

  clearHistory(): void {
    this.positionHistory.clear();
    console.log('GPS51DirectPositionService: Position history cleared');
  }
}
