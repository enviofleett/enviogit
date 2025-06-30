
export interface GPS51AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: Date;
}

export class GPS51TokenManager {
  private token: GPS51AuthToken | null = null;

  setToken(tokenData: { access_token: string; expires_in: number }): GPS51AuthToken {
    const token: GPS51AuthToken = {
      access_token: tokenData.access_token,
      token_type: 'Bearer',
      expires_in: tokenData.expires_in,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000))
    };

    this.token = token;
    this.saveTokenToStorage(token);
    return token;
  }

  getToken(): GPS51AuthToken | null {
    return this.token;
  }

  async getValidToken(): Promise<string | null> {
    // Try to load token from localStorage if not in memory
    if (!this.token) {
      this.loadTokenFromStorage();
    }

    // Check if token exists and is still valid
    if (this.token) {
      const currentTime = Date.now();
      const expiryTime = this.token.expires_at.getTime();
      
      if (currentTime >= expiryTime) {
        console.log('GPS51 token expired');
        this.clearToken();
        return null;
      }

      return this.token.access_token;
    }

    return null;
  }

  isTokenValid(): boolean {
    if (!this.token) {
      return false;
    }
    
    const currentTime = Date.now();
    const expiryTime = this.token.expires_at.getTime();
    return currentTime < expiryTime;
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('gps51_token');
  }

  private saveTokenToStorage(token: GPS51AuthToken): void {
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
