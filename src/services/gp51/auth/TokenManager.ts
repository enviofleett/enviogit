
import type { GPS51AuthToken } from './types';

export class TokenManager {
  private token: GPS51AuthToken | null = null;

  setToken(token: GPS51AuthToken): void {
    this.token = token;
    this.storeToken(token);
  }

  getToken(): GPS51AuthToken | null {
    return this.token;
  }

  getValidToken(): string | null {
    if (!this.token) {
      this.loadTokenFromStorage();
    }

    if (this.token && this.isTokenValid(this.token)) {
      return this.token.access_token;
    }

    return null;
  }

  isTokenValid(token: GPS51AuthToken): boolean {
    const currentTime = Date.now();
    const expiryTime = token.expires_at.getTime();
    return currentTime < expiryTime;
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('gps51_token');
  }

  private storeToken(token: GPS51AuthToken): void {
    const tokenData = {
      access_token: token.access_token,
      token_type: token.token_type,
      expires_in: token.expires_in,
      expires_at: token.expires_at.toISOString()
    };
    
    localStorage.setItem('gps51_token', JSON.stringify(tokenData));
  }

  private loadTokenFromStorage(): void {
    const storedToken = localStorage.getItem('gps51_token');
    if (storedToken) {
      try {
        const tokenData = JSON.parse(storedToken);
        this.token = {
          access_token: tokenData.access_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          expires_at: new Date(tokenData.expires_at)
        };
      } catch (e) {
        console.warn('Failed to parse stored GPS51 token');
        localStorage.removeItem('gps51_token');
      }
    }
  }
}
