
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

// Enhanced GPS51Position interface with all API specification fields
export interface GPS51Position {
  deviceid: string;
  devicetime: number;
  arrivedtime?: number;
  updatetime: number;
  validpoistiontime?: number;
  callat: number;
  callon: number;
  altitude: number;
  radius?: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  strstatusen?: string;
  alarm?: number;
  stralarm?: string;
  stralarmsen?: string;
  gotsrc?: string;
  rxlevel?: number;
  gpsvalidnum?: number;
  parklat?: number;
  parklon?: number;
  parktime?: number;
  parkduration?: number;
  // Fuel related fields
  totaloil?: number;
  masteroil?: number;
  slaveoil?: number;
  // Temperature fields
  temp1?: number;
  temp2?: number;
  temp3?: number;
  temp4?: number;
  // Humidity fields
  humi1?: number;
  humi2?: number;
  // Voltage and power
  voltage?: number;
  voltagev?: number;
  voltagepercent?: number;
  // IO and status fields
  iostatus?: number;
  currentoverspeedstate?: number;
  rotatestatus?: number;
  loadstatus?: number;
  weight?: number;
  reportmode?: number;
  fuel?: number;
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
  devicetype: string;
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
  groupid: string;
  groupname: string;
  remark?: string;
  shared?: number;
  devices: GPS51Device[];
}

// Enhanced API Response interface
export interface GPS51ApiResponse {
  status: number | string;
  message?: string;
  cause?: string;
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
