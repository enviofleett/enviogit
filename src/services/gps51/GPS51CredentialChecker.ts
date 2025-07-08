/**
 * GPS51 Credential Checker - PRODUCTION UTILITY
 * Provides centralized credential validation and debugging
 */

import { GPS51ConfigStorage } from './configStorage';

export interface CredentialStatus {
  isConfigured: boolean;
  hasApiUrl: boolean;
  hasUsername: boolean; 
  hasPassword: boolean;
  passwordLength: number;
  isValidMD5: boolean;
  issues: string[];
  recommendations: string[];
}

export class GPS51CredentialChecker {
  /**
   * Comprehensive credential check with detailed diagnostics
   */
  static checkCredentials(): CredentialStatus {
    console.log('GPS51CredentialChecker: Starting comprehensive credential check...');
    
    const status: CredentialStatus = {
      isConfigured: false,
      hasApiUrl: false,
      hasUsername: false,
      hasPassword: false,
      passwordLength: 0,
      isValidMD5: false,
      issues: [],
      recommendations: []
    };

    try {
      // Check individual localStorage items
      const apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const password = localStorage.getItem('gps51_password_hash');
      
      status.hasApiUrl = !!apiUrl;
      status.hasUsername = !!username;
      status.hasPassword = !!password;
      status.passwordLength = password?.length || 0;
      
      // Check if password is MD5 hash
      status.isValidMD5 = password ? /^[a-f0-9]{32}$/.test(password) : false;
      
      // Analyze issues
      if (!status.hasApiUrl) {
        status.issues.push('Missing API URL');
        status.recommendations.push('Set GPS51 API URL in Settings');
      }
      
      if (!status.hasUsername) {
        status.issues.push('Missing username');
        status.recommendations.push('Enter your GPS51 username in Settings');
      }
      
      if (!status.hasPassword) {
        status.issues.push('Missing password');
        status.recommendations.push('Enter your GPS51 password in Settings');
      } else if (status.passwordLength === 0) {
        status.issues.push('Empty password');
        status.recommendations.push('Password cannot be empty - enter valid GPS51 password');
      } else if (!status.isValidMD5) {
        status.issues.push('Password not properly hashed');
        status.recommendations.push('Password should be MD5 hashed - system will hash it automatically');
      }
      
      // Check configuration storage
      const config = GPS51ConfigStorage.getConfiguration();
      const configIsValid = GPS51ConfigStorage.isConfigured();
      
      status.isConfigured = configIsValid && status.hasApiUrl && status.hasUsername && 
                          status.hasPassword && status.passwordLength > 0;
      
      console.log('GPS51CredentialChecker: Credential analysis complete:', {
        status,
        config: config ? {
          hasApiUrl: !!config.apiUrl,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          passwordLength: config.password.length
        } : null,
        configStorageIsValid: configIsValid
      });
      
      return status;
      
    } catch (error) {
      console.error('GPS51CredentialChecker: Check failed:', error);
      status.issues.push(`Credential check failed: ${error.message}`);
      status.recommendations.push('Clear browser storage and reconfigure GPS51 credentials');
      return status;
    }
  }
  
  /**
   * Get user-friendly error message for missing credentials
   */
  static getCredentialErrorMessage(): string {
    const status = this.checkCredentials();
    
    if (status.isConfigured) {
      return '';
    }
    
    if (status.issues.length === 0) {
      return 'GPS51 credentials validation failed for unknown reason';
    }
    
    const primaryIssue = status.issues[0];
    const recommendation = status.recommendations[0] || 'Please configure GPS51 in Settings';
    
    return `GPS51 Error: ${primaryIssue}. ${recommendation}.`;
  }
  
  /**
   * Clear all GPS51 credentials
   */
  static clearCredentials(): void {
    try {
      GPS51ConfigStorage.clearConfiguration();
      console.log('GPS51CredentialChecker: All credentials cleared');
    } catch (error) {
      console.error('GPS51CredentialChecker: Failed to clear credentials:', error);
    }
  }
}