
export interface SessionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastSync: Date | null;
  error: string | null;
  isConfigured: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  connectionHealth: 'good' | 'poor' | 'lost';
}

export interface GPS51ConnectionCredentials {
  username: string;
  password: string;
  apiKey?: string;
  apiUrl: string;
  from?: string;
  type?: string;
}
