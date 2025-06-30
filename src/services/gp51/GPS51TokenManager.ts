
export interface GPS51AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: Date;
}

export class GPS51TokenManager {
  private token: GPS51AuthToken | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-load token on initialization
    this.loadTokenFromStorage();
    this.setupAutoRefresh();
  }

  setToken(tokenData: { access_token: string; expires_in: number }): GPS51AuthToken {
    const token: GPS51AuthToken = {
      access_token: tokenData.access_token,
      token_type: 'Bearer',
      expires_in: tokenData.expires_in,
      expires_at: new Date(Date.now() + (tokenData.expires_in * 1000))
    };

    this.token = token;
    this.saveTokenToStorage(token);
    this.setupAutoRefresh();
    return token;
  }

  getToken(): GPS51AuthToken | null {
    return this.token;
  }

  async getValidToken(): Promise<string | null> {
    // Auto-load if not in memory
    if (!this.token) {
      this.loadTokenFromStorage();
    }

    // Check if token exists and is still valid
    if (this.token) {
      const currentTime = Date.now();
      const expiryTime = this.token.expires_at.getTime();
      
      // Check if token expires within 5 minutes (refresh early)
      const refreshThreshold = 5 * 60 * 1000; // 5 minutes
      
      if (currentTime >= expiryTime) {
        console.log('GPS51 token expired, clearing...');
        this.clearToken();
        return null;
      } else if (currentTime >= (expiryTime - refreshThreshold)) {
        console.log('GPS51 token expires soon, needs refresh...');
        // Token needs refresh but is still valid for now
        return this.token.access_token;
      }

      return this.token.access_token;
    }

    return null;
  }

  isTokenValid(): boolean {
    if (!this.token) {
      this.loadTokenFromStorage();
    }
    
    if (!this.token) {
      return false;
    }
    
    const currentTime = Date.now();
    const expiryTime = this.token.expires_at.getTime();
    return currentTime < expiryTime;
  }

  needsRefresh(): boolean {
    if (!this.token) {
      return false;
    }
    
    const currentTime = Date.now();
    const expiryTime = this.token.expires_at.getTime();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    
    return currentTime >= (expiryTime - refreshThreshold);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('gps51_token');
    this.clearAutoRefresh();
  }

  private setupAutoRefresh(): void {
    this.clearAutoRefresh();
    
    if (!this.token) return;
    
    const currentTime = Date.now();
    const expiryTime = this.token.expires_at.getTime();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
    const refreshTime = expiryTime - refreshThreshold;
    
    if (refreshTime > currentTime) {
      const timeUntilRefresh = refreshTime - currentTime;
      console.log(`GPS51 token auto-refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`);
      
      this.refreshTimer = setTimeout(() => {
        console.log('GPS51 token auto-refresh triggered');
        // Emit event that can be listened to by auth services
        window.dispatchEvent(new CustomEvent('gps51-token-refresh-needed'));
      }, timeUntilRefresh);
    }
  }

  private clearAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private saveTokenToStorage(token: GPS51AuthToken): void {
    const tokenData = {
      access_token: token.access_token,
      token_type: token.token_type,
      expires_in: token.expires_in,
      expires_at: token.expires_at.toISOString()
    };
    
    localStorage.setItem('gps51_token', JSON.stringify(tokenData));
    console.log('GPS51 token saved to localStorage with expiry:', token.expires_at.toISOString());
  }

  private loadTokenFromStorage(): void {
    const storedToken = localStorage.getItem('gps51_token');
    if (storedToken) {
      try {
        const tokenData = JSON.parse(storedToken);
        const expiryDate = new Date(tokenData.expires_at);
        
        // Check if stored token is still valid
        if (expiryDate.getTime() > Date.now()) {
          this.token = {
            access_token: tokenData.access_token,
            token_type: tokenData.token_type,
            expires_in: tokenData.expires_in,
            expires_at: expiryDate
          };
          
          console.log('GPS51 token restored from localStorage, expires:', expiryDate.toISOString());
          this.setupAutoRefresh();
        } else {
          console.log('Stored GPS51 token expired, removing...');
          localStorage.removeItem('gps51_token');
        }
      } catch (e) {
        console.warn('Failed to parse stored GPS51 token');
        localStorage.removeItem('gps51_token');
      }
    }
  }
}
