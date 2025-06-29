
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
