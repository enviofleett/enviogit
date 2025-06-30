
import { GPS51AuthManager } from '../gps51/GPS51AuthManager';
import { GPS51Credentials } from './GPS51CredentialsManager';
import { GPS51AuthToken } from './GPS51TokenManager';

// Re-export types for backward compatibility
export type { GPS51AuthToken, GPS51Credentials };

export class GPS51AuthService {
  private static instance: GPS51AuthService;
  private authManager = new GPS51AuthManager();

  static getInstance(): GPS51AuthService {
    if (!GPS51AuthService.instance) {
      GPS51AuthService.instance = new GPS51AuthService();
    }
    return GPS51AuthService.instance;
  }

  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthToken> {
    return this.authManager.authenticate(credentials);
  }

  async getValidToken(): Promise<string | null> {
    return this.authManager.getValidToken();
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    return this.authManager.refreshToken();
  }

  async restoreAuthentication(): Promise<boolean> {
    if (typeof this.authManager.restoreAuthentication === 'function') {
      return this.authManager.restoreAuthentication();
    }
    return false;
  }

  logout(): void {
    this.authManager.logout();
  }

  isAuthenticated(): boolean {
    return this.authManager.isAuthenticated();
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.authManager.getTokenInfo();
  }

  getUser() {
    return this.authManager.getUser();
  }

  getClient() {
    return this.authManager.getClient();
  }

  getAuthManager() {
    return this.authManager;
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();
