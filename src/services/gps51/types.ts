
export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

export interface GPS51Credentials {
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
  apiUrl: string;
}

export interface SyncResult {
  success: boolean;
  vehiclesSynced?: number;
  positionsStored?: number;
  error?: string;
}

// GPS51 API Types
export interface GPS51ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

export interface GPS51Vehicle {
  id: string;
  name: string;
  plate: string;
  brand: string;
  model: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GPS51Position {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude?: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
  ignition: boolean;
  fuel?: number;
  temperature?: number;
  batteryLevel?: number;
}

export interface GPS51Telemetry {
  vehicleId: string;
  odometer: number;
  fuelLevel: number;
  engineTemperature: number;
  batteryVoltage: number;
  engineHours: number;
  timestamp: string;
}

export interface GPS51Geofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: number[][];
  radius?: number;
  description?: string;
}

// Real-time sync types
export interface RealTimeGPS51Data {
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  timestamp: Date;
  ignitionStatus: boolean;
  fuel?: number;
  temperature?: number;
  address?: string;
}

export interface RealTimeSyncStatus {
  isActive: boolean;
  isConnected: boolean;
  lastUpdate: Date | null;
  activeDevices: number;
  error: string | null;
}
