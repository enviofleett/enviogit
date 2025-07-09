
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
  // Enhanced fields for permission analysis
  permissionIssueDetected?: boolean;
  permissionAnalysis?: {
    issue: string;
    recommendation: string;
    statusOk: boolean;
    dataEmpty: boolean;
    likelyPermissionDenied: boolean;
  };
  authIssueDetected?: {
    hasAuthIssue: boolean;
    issueType: 'token_expired' | 'permission_denied' | 'invalid_token' | 'rate_limited' | 'none';
    recommendation: string;
  };
  authAnalysis?: {
    tokenValid: boolean;
    hasDataAccess: boolean;
    issueType: string;
    recommendation: string;
  };
  proxy_metadata?: {
    responseType: string;
    totalDuration: number;
    gpsFetchDuration: number;
    processingDuration: number;
    timestamp: string;
  };
}

export interface GPS51Group {
  groupid: string; // Ensure string type per API spec
  groupname: string;
  remark?: string;
  shared?: number;
  devices: GPS51Device[];
}

// User Registration Types
export interface GPS51UserRegistration {
  username: string; // email or unique identifier
  password: string; // will be MD5 hashed
  usertype: number; // 11 for End User
  multilogin: number; // 0 or 1
  creater?: string; // creating user
  companyname?: string;
  showname?: string; // display name
}

// Device Registration Types
export interface GPS51DeviceRegistration {
  deviceid: string; // device identifier
  devicename: string; // display name for device
  devicetype?: string; // device type
  groupid?: string; // group assignment
  creater?: string; // creating user
}

// Batch Operation Types
export interface GPS51BatchOperation {
  deviceids: string[]; // array of device IDs
  operation: 'ModifyExpiringTime' | 'ModifyDeviceType' | 'DeleteDevice';
  expiretime?: number; // for ModifyExpiringTime
  devicetype?: string; // for ModifyDeviceType
}

// Command Types
export interface GPS51Command {
  deviceid: string;
  cmdtype: 'ENGINE_ON' | 'ENGINE_OFF' | 'IMMOBILIZER_ON' | 'IMMOBILIZER_OFF' | 'LOCATE';
  content?: string; // additional command parameters
}

// Enhanced User Profile (for internal database)
export interface UserProfile {
  id: string;
  gps51_username: string; // links to GPS51 user
  full_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  created_at: string;
  updated_at: string;
}

// Subscription Types
export interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  price_quarterly?: number;
  price_annually?: number;
  trial_days: number;
  features: string[];
  is_active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  package_id: string;
  vehicle_id?: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_end_date?: string;
  subscription_end_date?: string;
}
