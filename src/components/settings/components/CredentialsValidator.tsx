
import { md5 } from 'js-md5';

export interface GPS51CredentialsValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class CredentialsValidator {
  static validateCredentials(credentials: {
    apiUrl: string;
    username: string;
    password: string;
    from?: string;
    type?: string;
  }): GPS51CredentialsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!credentials.apiUrl || credentials.apiUrl.trim() === '') {
      errors.push('API URL is required');
    }

    if (!credentials.username || credentials.username.trim() === '') {
      errors.push('Username is required');
    }

    if (!credentials.password || credentials.password.trim() === '') {
      errors.push('Password is required');
    }

    // API URL validation
    if (credentials.apiUrl) {
      try {
        const url = new URL(credentials.apiUrl);
        
        // Check for correct GPS51 domain
        if (!url.hostname.includes('gps51.com')) {
          warnings.push('API URL should use gps51.com domain');
        }

        // Check for deprecated endpoint
        if (url.pathname.includes('/webapi')) {
          errors.push('Please use the new /openapi endpoint instead of /webapi');
        }

        // Ensure using openapi endpoint
        if (!url.pathname.includes('/openapi')) {
          warnings.push('API URL should use the /openapi endpoint');
        }
      } catch {
        errors.push('Invalid API URL format');
      }
    }

    // Password format validation
    if (credentials.password) {
      const isValidMD5 = /^[a-f0-9]{32}$/.test(credentials.password);
      if (!isValidMD5 && credentials.password.length < 6) {
        warnings.push('Password should be at least 6 characters long');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  static isValidMD5(str: string): boolean {
    return /^[a-f0-9]{32}$/.test(str);
  }

  static hashPassword(plainPassword: string): string {
    if (this.isValidMD5(plainPassword)) {
      return plainPassword; // Already hashed
    }
    return md5(plainPassword).toLowerCase();
  }

  static validateStoredCredentials(): GPS51CredentialsValidationResult {
    const apiUrl = localStorage.getItem('gps51_api_url');
    const username = localStorage.getItem('gps51_username');
    const passwordHash = localStorage.getItem('gps51_password_hash');

    return this.validateCredentials({
      apiUrl: apiUrl || '',
      username: username || '',
      password: passwordHash || '',
      from: localStorage.getItem('gps51_from') || 'WEB',
      type: localStorage.getItem('gps51_type') || 'USER'
    });
  }
}
