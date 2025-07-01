
export interface GPS51SyncRequest {
  apiUrl?: string;
  username?: string;
  password?: string;
  priority?: number;
  batchMode?: boolean;
  cronTriggered?: boolean;
}

export interface GPS51ApiResponse {
  status: number;
  message?: string;
  data?: any;
  token?: string;
  groups?: any[];
  records?: any[];
}

export interface GPS51Device {
  deviceid: string;
  devicename: string;
  devicetype: number;
  simnum: string;
  lastactivetime: number;
  isfree: number;
  allowedit: number;
  icon: number;
}

export interface GPS51Position {
  deviceid: string;
  callat: number;
  callon: number;
  updatetime: number;
  speed: number;
  course: number;
  moving: number;
  strstatus: string;
  temp1?: number;
  voltagepercent?: number;
  status: number;
}
