
export interface GPS51AuthCredentials {
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
  apiUrl: string;
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

export interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: string; // Updated to string per API spec
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
  // Enhanced fields from API specification
  overduetime?: string;
  expirenotifytime?: string;
  remark?: string;
  creater?: string;
  videochannelcount?: number;
  stared?: string;
  loginame?: string;
}

export interface GPS51Position {
  deviceid: string;
  devicetime: number;
  callat: number;
  callon: number;
  altitude: number;
  speed: number;
  course: number;
  totaldistance: number;
  status: number;
  moving: number;
  strstatus: string;
  updatetime: number;
  temp1?: number;
  temp2?: number;
  voltage?: number;
  fuel?: number;
  radius?: number;
  gotsrc?: string;
  rxlevel?: number;
  voltagepercent?: number;
}

export interface GPS51ApiResponse {
  status: number | string; // Enhanced to support both types
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
  // Command and geofence responses
  id?: string;
  geofenceid?: string;
  // Trip data responses
  trips?: any[];
  // Video streaming responses
  streamurl?: string;
  url?: string;
}

export interface GPS51Group {
  groupid: string; // Ensure string type per API spec
  groupname: string;
  remark?: string;
  shared?: number;
  devices: GPS51Device[];
}
