
export interface GPS51ConnectionCredentials {
  username: string;
  password: string;
  apiKey?: string;
  apiUrl: string;
  from?: string;
  type?: string;
}

export class GPS51CredentialValidator {
  static isValidMD5(str: string): boolean {
    return /^[a-f0-9]{32}$/.test(str);
  }

  static validateCredentials(credentials: GPS51ConnectionCredentials): void {
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required');
    }
    
    if (!credentials.apiUrl) {
      throw new Error('API URL is required');
    }
  }

  static migrateApiUrl(apiUrl: string): string {
    // Auto-migrate webapi to openapi endpoint
    if (apiUrl.includes('/webapi')) {
      console.warn('GPS51CredentialValidator: Auto-migrating API URL from /webapi to /openapi');
      return apiUrl.replace('/webapi', '/openapi');
    }
    return apiUrl;
  }

  static prepareAuthCredentials(credentials: GPS51ConnectionCredentials) {
    const migratedUrl = this.migrateApiUrl(credentials.apiUrl);
    
    return {
      username: credentials.username,
      password: credentials.password, // Use as-is, should already be MD5 hashed
      apiKey: credentials.apiKey,
      apiUrl: migratedUrl,
      from: (credentials.from as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
      type: (credentials.type as 'USER' | 'DEVICE') || 'USER'
    };
  }

  static getErrorMessage(error: unknown): string {
    let errorMessage = error instanceof Error ? error.message : 'Connection failed';
    
    // Provide helpful guidance for common issues
    if (errorMessage.includes('8901')) {
      errorMessage += '\n\nTroubleshooting tips:\n• Verify your username and password are correct\n• Ensure you are using the correct API URL\n• Check that your account has proper permissions';
    } else if (errorMessage.includes('Login failed')) {
      errorMessage += '\n\nPossible causes:\n• Incorrect username/password\n• Account locked or suspended\n• API endpoint not reachable\n• Invalid from/type parameters';
    }
    
    return errorMessage;
  }
}
