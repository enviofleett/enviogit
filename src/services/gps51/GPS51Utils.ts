import { GPS51TimeManager } from './GPS51TimeManager';

export class GPS51Utils {
  static generateToken(): string {
    // Generate a proper random token using crypto
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static validateMD5Hash(password: string): boolean {
    // Check if password is a valid MD5 hash (32 lowercase hex characters)
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  static async ensureMD5Hash(password: string): Promise<string> {
    // Handle null/undefined passwords
    if (!password) {
      throw new Error('Password is required for MD5 hashing');
    }

    // If password is already a valid MD5 hash, return as-is
    if (this.validateMD5Hash(password)) {
      return password;
    }
    
    // Use dynamic import for MD5 function in ES module environment
    try {
      const { md5 } = await import('js-md5');
      const hashedPassword = md5(password).toLowerCase();
      console.log('GPS51Utils: Password successfully hashed to MD5');
      return hashedPassword;
    } catch (error) {
      console.error('GPS51Utils: MD5 module import failed:', error);
      throw new Error('Failed to hash password - MD5 module not available');
    }
  }

  static async createGPS51LoginParams(credentials: any): Promise<any> {
    if (!credentials.username || !credentials.password) {
      throw new Error('Username and password are required');
    }

    const hashedPassword = await this.ensureMD5Hash(credentials.password);
    
    return {
      username: credentials.username,
      password: hashedPassword,
      from: credentials.from || 'WEB',
      type: credentials.type || 'USER'
    };
  }

  static normalizeApiUrl(apiUrl: string): string {
    if (apiUrl.includes('www.gps51.com')) {
      console.warn('Correcting API URL from www.gps51.com to api.gps51.com');
      return apiUrl.replace('www.gps51.com', 'api.gps51.com').replace('/webapi', '/openapi');
    } else if (apiUrl.includes('/webapi')) {
      console.warn('Migrating API URL from /webapi to /openapi endpoint');
      return apiUrl.replace('/webapi', '/openapi');
    }
    return apiUrl;
  }

  static getPasswordValidationInfo(password: string | null | undefined) {
    if (!password) {
      return {
        isValidMD5: false,
        passwordLength: 0,
        hasUppercase: false,
        hasLowercase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        isAvailable: false
      };
    }

    return {
      isValidMD5: this.validateMD5Hash(password),
      passwordLength: password.length,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSpecialChars: /[^a-zA-Z0-9]/.test(password),
      isAvailable: true
    };
  }

  /**
   * Enhanced error analysis for GPS51 API responses
   */
  static analyzeApiError(error: any, context: string): {
    errorType: 'network' | 'authentication' | 'server' | 'data' | 'timeout' | 'unknown';
    message: string;
    suggestions: string[];
    isRetryable: boolean;
  } {
    const suggestions: string[] = [];
    let errorType: 'network' | 'authentication' | 'server' | 'data' | 'timeout' | 'unknown' = 'unknown';
    let message = error?.message || 'Unknown error occurred';
    let isRetryable = false;

    // Network-related errors
    if (message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED')) {
      errorType = 'network';
      message = 'Network connection error';
      suggestions.push('Check internet connection');
      suggestions.push('Verify GPS51 API URL is accessible');
      suggestions.push('Check firewall settings');
      isRetryable = true;
    }
    // Authentication errors
    else if (message.includes('401') || message.includes('unauthorized') || message.includes('token')) {
      errorType = 'authentication';
      message = 'Authentication failed';
      suggestions.push('Verify GPS51 credentials are correct');
      suggestions.push('Check if password is properly MD5 hashed');
      suggestions.push('Ensure token is being passed correctly');
      isRetryable = false;
    }
    // Server errors
    else if (message.includes('500') || message.includes('502') || message.includes('503')) {
      errorType = 'server';
      message = 'GPS51 server error';
      suggestions.push('GPS51 server may be temporarily unavailable');
      suggestions.push('Try again in a few minutes');
      isRetryable = true;
    }
    // Timeout errors
    else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      errorType = 'timeout';
      message = 'Request timeout';
      suggestions.push('GPS51 server response is slow');
      suggestions.push('Check server time synchronization');
      suggestions.push('Reduce query frequency');
      isRetryable = true;
    }
    // Data-related errors
    else if (message.includes('parse') || message.includes('JSON') || message.includes('invalid')) {
      errorType = 'data';
      message = 'Data parsing error';
      suggestions.push('GPS51 API returned unexpected data format');
      suggestions.push('Check API endpoint compatibility');
      isRetryable = false;
    }

    // Context-specific suggestions
    if (context === 'live_data') {
      suggestions.push('Check if devices are online and active');
      suggestions.push('Verify lastquerypositiontime parameter');
      suggestions.push('Ensure proper UTC time synchronization');
    } else if (context === 'device_list') {
      suggestions.push('Verify user has access to devices');
      suggestions.push('Check if account has proper permissions');
    } else if (context === 'login') {
      suggestions.push('Verify username format (supports Chinese/English)');
      suggestions.push('Ensure password is MD5 hash (32 lowercase hex)');
      suggestions.push('Check from and type parameters');
    }

    return {
      errorType,
      message,
      suggestions,
      isRetryable
    };
  }

  /**
   * Enhanced logging with time synchronization context
   */
  static logWithTimestamp(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = GPS51TimeManager.getCurrentUtcTimestamp();
    const watTime = GPS51TimeManager.utcTimestampToWat(timestamp);
    
    const logData = {
      utcTimestamp: timestamp,
      watTime: watTime.toISOString(),
      ...data
    };

    if (level === 'error') {
      console.error(`[${watTime.toISOString()}] ${message}`, logData);
    } else if (level === 'warn') {
      console.warn(`[${watTime.toISOString()}] ${message}`, logData);
    } else {
      console.log(`[${watTime.toISOString()}] ${message}`, logData);
    }
  }

  /**
   * Diagnostic information for troubleshooting
   */
  static generateDiagnosticInfo(): {
    timestamp: {
      utc: number;
      wat: string;
      serverDrift: string;
    };
    browser: {
      userAgent: string;
      timezone: string;
      language: string;
    };
    connection: {
      online: boolean;
      effectiveType?: string;
    };
  } {
    const utcTimestamp = GPS51TimeManager.getCurrentUtcTimestamp();
    const watTime = GPS51TimeManager.utcTimestampToWat(utcTimestamp);
    
    return {
      timestamp: {
        utc: utcTimestamp,
        wat: watTime.toISOString(),
        serverDrift: 'Not calculated yet'
      },
      browser: {
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language
      },
      connection: {
        online: navigator.onLine,
        effectiveType: (navigator as any).connection?.effectiveType
      }
    };
  }
}