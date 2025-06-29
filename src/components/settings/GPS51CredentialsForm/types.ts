
export interface GPS51FormData {
  apiUrl: string;
  username: string;
  password: string;
  apiKey: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

export interface GPS51DebugInfo {
  originalPassword: {
    length: number;
    isAlreadyHashed: boolean;
    firstChars: string;
  };
  processedPassword: {
    length: number;
    isValidMD5: boolean;
    firstChars: string;
  };
  credentials: any;
  timestamp: string;
}
