
export interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  moving: number;
  strstatus: string;
  totaldistance: number;
  course: number;
  altitude: number;
  radius: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
}

export interface LiveDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
  enableWebSocket?: boolean;
  enableIntelligentFiltering?: boolean;
}

export interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  movingVehicles: number;
  parkedDevices: number;
  offlineVehicles: number;
  totalDistance: number;
  averageSpeed: number;
  vehiclesWithGPS: number;
  vehiclesWithoutGPS: number;
  realTimeConnected: boolean;
  lastUpdateTime: Date | null;
}
