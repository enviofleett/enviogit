
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

// Enhanced GPS51 Device interface matching API specification
export interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: string; // Changed from number to string
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
  // New fields from API specification
  overduetime?: string;
  expirenotifytime?: string;
  remark?: string;
  creater?: string;
  videochannelcount?: number;
  stared?: string;
  loginame?: string;
}

// Enhanced GPS51 Group interface matching API specification
export interface GPS51Group {
  groupid: string; // Ensure string type
  groupname: string;
  remark?: string;
  shared?: number;
  devices: GPS51Device[];
}

// Enhanced API Response interface
export interface GPS51ApiResponse {
  status: number | string; // Support both for flexibility
  message?: string;
  cause?: string; // Added cause field for detailed error info
  data?: any;
  token?: string;
  user?: GPS51User;
  devices?: GPS51Device[];
  positions?: GPS51Position[];
  groups?: GPS51Group[];
  records?: GPS51Position[];
  lastquerypositiontime?: number;
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

export interface GPS51ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}
