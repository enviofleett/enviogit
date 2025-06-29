
import { gps51Client } from '../gps51/GPS51Client';
import { TokenManager } from './auth/TokenManager';
import { CredentialsManager } from './auth/CredentialsManager';
import { AuthenticationHandler } from './auth/AuthenticationHandler';
import type { GPS51AuthToken, GPS51Credentials } from './auth/types';

export class GPS51AuthService {
  private static instance: GPS51AuthService;
  private tokenManager = new TokenManager();
  private credentialsManager = new CredentialsManager();
  private authHandler = new AuthenticationHandler();

  static getInstance(): GPS51AuthService {
    if (!GPS51AuthService.instance) {
      GPS51AuthService.instance = new GPS51AuthService();
    }
    return GPS51AuthService.instance;
  }

  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthToken> {
    try {
      const token = await this.authHandler.authenticate(credentials);
      
      this.tokenManager.setToken(token);
      this.credentialsManager.setCredentials(credentials);
      
      return token;
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  async getValidToken(): Promise<string | null> {
    const token = this.tokenManager.getValidToken();
    
    if (!token) {
      console.log('GPS51 token expired, attempting refresh...');
      const refreshed = await this.refreshToken();
      return refreshed ? refreshed.access_token : null;
    }

    return token;
  }

  async getTokenObject(): Promise<GPS51AuthToken | null> {
    const tokenString = await this.getValidToken();
    return tokenString ? this.tokenManager.getToken() : null;
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    const credentials = this.credentialsManager.getCredentials();

    if (!credentials) {
      console.warn('No stored credentials for GPS51 token refresh');
      return null;
    }

    try {
      const token = await this.authHandler.refreshToken();
      
      if (token) {
        this.tokenManager.setToken(token);
        return token;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to refresh GPS51 token:', error);
      return null;
    }
  }

  logout(): void {
    this.tokenManager.clearToken();
    this.credentialsManager.clearCredentials();
    gps51Client.logout();
    console.log('GPS51AuthService: Session logged out');
  }

  isAuthenticated(): boolean {
    const token = this.tokenManager.getToken();
    
    if (!token) {
      return false;
    }
    
    return this.tokenManager.isTokenValid(token);
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.tokenManager.getToken();
  }

  getUser() {
    return gps51Client.getUser();
  }

  getClient() {
    return gps51Client;
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();

// Re-export types for backward compatibility
export type { GPS51AuthToken, GPS51Credentials } from './auth/types';
