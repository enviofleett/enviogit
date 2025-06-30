
export interface GPS51Config {
  apiUrl: string;
  username: string;
  password: string;
  apiKey?: string;
  from?: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type?: 'USER' | 'DEVICE';
}

export interface GPS51SyncResult {
  success: boolean;
  vehiclesSynced: number;
  positionsStored: number;
  devicesFound: number;
  positionsFound?: number;
  error?: string;
}

export interface GPS51StoredCredentials {
  username: string;
  apiUrl: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
  hasApiKey: boolean;
  savedAt: string;
}
