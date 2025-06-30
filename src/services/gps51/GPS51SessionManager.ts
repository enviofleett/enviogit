
import { GPS51User } from './GPS51Types';
import { GPS51_DEFAULTS } from './GPS51Constants';

export class GPS51SessionManager {
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private user: GPS51User | null = null;

  setAuthData(token: string, user: GPS51User | null): void {
    this.token = token;
    this.user = user;
    this.tokenExpiry = Date.now() + (GPS51_DEFAULTS.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): GPS51User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!(this.token && (!this.tokenExpiry || Date.now() < this.tokenExpiry));
  }

  ensureAuthenticated(): void {
    if (!this.token) {
      throw new Error('Not authenticated. Please call authenticate() first.');
    }

    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      throw new Error('Token expired. Please re-authenticate.');
    }
  }

  logout(): void {
    this.token = null;
    this.tokenExpiry = null;
    this.user = null;
  }
}
