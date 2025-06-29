
export interface GPS51AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: Date;
}

export interface GPS51Credentials {
  username: string;
  password: string;
  apiKey?: string;
  apiUrl: string;
  from?: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type?: 'USER' | 'DEVICE';
}

export interface GPS51AuthResult {
  success: boolean;
  token?: string;
  error?: string;
  user?: any;
}
