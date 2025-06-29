
import { md5 } from 'js-md5';

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

export const isValidMD5 = (str: string): boolean => {
  return /^[a-f0-9]{32}$/.test(str);
};

export const prepareCredentials = (formData: any): { credentials: any; debugInfo: GPS51DebugInfo } => {
  const hashedPassword = isValidMD5(formData.password) ? formData.password : md5(formData.password).toLowerCase();
  
  const credentials = {
    apiUrl: formData.apiUrl,
    username: formData.username,
    password: hashedPassword,
    apiKey: formData.apiKey,
    from: formData.from,
    type: formData.type
  };

  const debugInfo: GPS51DebugInfo = {
    originalPassword: {
      length: formData.password.length,
      isAlreadyHashed: isValidMD5(formData.password),
      firstChars: formData.password.substring(0, 4) + '...'
    },
    processedPassword: {
      length: hashedPassword.length,
      isValidMD5: isValidMD5(hashedPassword),
      firstChars: hashedPassword.substring(0, 8) + '...'
    },
    credentials: {
      ...credentials,
      password: hashedPassword.substring(0, 8) + '...'
    },
    timestamp: new Date().toISOString()
  };

  return { credentials, debugInfo };
};

export const saveCredentialsToStorage = (credentials: any) => {
  try {
    localStorage.setItem('gps51_api_url', credentials.apiUrl);
    localStorage.setItem('gps51_username', credentials.username);
    localStorage.setItem('gps51_password_hash', credentials.password);
    localStorage.setItem('gps51_from', credentials.from);
    localStorage.setItem('gps51_type', credentials.type);
    
    if (credentials.apiKey) {
      localStorage.setItem('gps51_api_key', credentials.apiKey);
    }

    const safeCredentials = {
      username: credentials.username,
      apiUrl: credentials.apiUrl,
      from: credentials.from,
      type: credentials.type,
      hasApiKey: !!credentials.apiKey
    };
    localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
    
    console.log('GPS51 credentials saved to localStorage');
  } catch (error) {
    console.error('Failed to save credentials to localStorage:', error);
    throw new Error('Failed to save credentials');
  }
};
