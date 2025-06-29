
import { GPS51AuthCredentials, GPS51User } from '../gps51/types';
import { GPS51Client } from '../gps51/GPS51Client';
import { gps51SessionManager } from './GPS51SessionManager';

export class GPS51AuthService {
  private static instance: GPS51AuthService;
  private gps51Client: GPS51Client;

  private constructor() {
    this.gps51Client = new GPS51Client();
  }

  static getInstance(): GPS51AuthService {
    if (!GPS51AuthService.instance) {
      GPS51AuthService.instance = new GPS51AuthService();
    }
    return GPS51AuthService.instance;
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string; access_token?: string }> {
    try {
      console.log('GPS51AuthService: Starting authentication...');
      
      const result = await this.gps51Client.authenticate(credentials);
      
      if (result.success && result.user) {
        // Store session data
        await gps51SessionManager.createSession(credentials);
        console.log('GPS51AuthService: Authentication successful, session created');
        
        // Get the token for backward compatibility
        const token = await this.gps51Client.getValidToken();
        
        return {
          success: true,
          user: result.user,
          access_token: token?.access_token
        };
      } else {
        console.error('GPS51AuthService: Authentication failed:', result.error);
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('GPS51AuthService: Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  async isAuthenticatedAsync(): Promise<boolean> {
    return this.gps51Client.isAuthenticated();
  }

  isAuthenticated(): boolean {
    return this.gps51Client.isAuthenticated();
  }

  async getUser(): Promise<GPS51User | null> {
    return this.gps51Client.getUser();
  }

  async getValidToken(): Promise<any> {
    return this.gps51Client.getValidToken();
  }

  logout(): void {
    this.gps51Client.logout();
    gps51SessionManager.clearSession();
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();
