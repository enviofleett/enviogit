
// GPS51 API Response Types
export interface GPS51Vehicle {
  id: string;
  name: string;
  plate: string;
  brand?: string;
  model?: string;
  type: 'car' | 'truck' | 'van' | 'motorcycle';
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface GPS51Position {
  vehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed: number;
  heading: number;
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
  vehicleIds: string[];
  alerts: {
    enter: boolean;
    exit: boolean;
  };
}

export interface GPS51ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}
