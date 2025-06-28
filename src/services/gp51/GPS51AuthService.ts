
import { gps51Client, GPS51AuthCredentials } from '../gps51/GPS51Client';

export interface GPS51AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: Date;
}

export interface GPS51Credentials {
  username: string;
  password: string;
  apiKey?: string;
  apiUrl: string;
  from?: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type?: 'USER' | 'DEVICE';
}

export class GPS51AuthService {
  private static instance: GPS51AuthService;
  private token: GPS51AuthToken | null = null;
  private credentials: GPS51Credentials | null = null;

  static getInstance(): GPS51AuthService {
    if (!GPS51AuthService.instance) {
      GPS51AuthService.instance = new GPS51AuthService();
    }
    return GPS51AuthService.instance;
  }

  async authenticate(credentials: GPS51Credentials): Promise<GPS51AuthToken> {
    try {
      console.log('GPS51AuthService: Starting authentication...');
      
      const authCredentials: GPS51AuthCredentials = {
        username: credentials.username,
        password: credentials.password, // Should already be MD5 hashed
        apiUrl: credentials.apiUrl,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER'
      };

      const result = await gps51Client.authenticate(authCredentials);

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      const token: GPS51AuthToken = {
        access_token: gps51Client.getToken() || '',
        token_type: 'Bearer',
        expires_in: 24 * 60 * 60, // 24 hours
        expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000))
      };

      this.token = token;
      this.credentials = credentials;
      
      // Store token securely (without sensitive data)
      const tokenData = {
        access_token: token.access_token,
        token_type: token.token_type,
        expires_in: token.expires_in,
        expires_at: token.expires_at.toISOString()
      };
      
      localStorage.setItem('gps51_token', JSON.stringify(tokenData));
      
      // Store non-sensitive credentials
      const safeCredentials = {
        username: credentials.username,
        apiUrl: credentials.apiUrl,
        from: credentials.from,
        type: credentials.type
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
      
      console.log('GPS51AuthService: Authentication successful');
      return token;

    } catch (error) {
      console.error('GPS51AuthService: Authentication failed:', error);
      this.logout();
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getValidToken(): Promise<string | null> {
    // Try to load token from localStorage if not in memory
    if (!this.token) {
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

    // Check if token exists and is still valid
    if (this.token) {
      const currentTime = Date.now();
      const expiryTime = this.token.expires_at.getTime();
      
      if (currentTime >= expiryTime) {
        console.log('GPS51 token expired, attempting refresh...');
        this.token = null;
        localStorage.removeItem('gps51_token');
        
        // Try to refresh if we have stored credentials
        const refreshed = await this.refreshToken();
        return refreshed ? refreshed.access_token : null;
      }

      return this.token.access_token;
    }

    return null;
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    // Try to load credentials from localStorage if not in memory
    if (!this.credentials) {
      const storedCreds = localStorage.getItem('gps51_credentials');
      
      if (storedCreds) {
        try {
          const creds = JSON.parse(storedCreds);
          // Note: We don't store passwords, so refresh might not be possible
          // without re-authentication
          console.warn('GPS51AuthService: Cannot refresh token without stored password');
          return null;
        } catch (e) {
          console.warn('Failed to parse stored GPS51 credentials');
          return null;
        }
      }
    }

    if (!this.credentials) {
      console.warn('No stored credentials for GPS51 token refresh');
      return null;
    }

    try {
      // Try to refresh using the GPS51 client
      const refreshSuccess = await gps51Client.refreshToken();
      if (refreshSuccess) {
        // Token is still valid, update expiry
        const token: GPS51AuthToken = {
          access_token: gps51Client.getToken() || '',
          token_type: 'Bearer',
          expires_in: 24 * 60 * 60,
          expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000))
        };
        
        this.token = token;
        localStorage.setItem('gps51_token', JSON.stringify({
          access_token: token.access_token,
          token_type: token.token_type,
          expires_in: token.expires_in,
          expires_at: token.expires_at.toISOString()
        }));
        
        return token;
      } else {
        // Need full re-authentication
        return null;
      }
    } catch (error) {
      console.error('Failed to refresh GPS51 token:', error);
      return null;
    }
  }

  logout(): void {
    this.token = null;
    this.credentials = null;
    gps51Client.logout();
    localStorage.removeItem('gps51_token');
    localStorage.removeItem('gps51_credentials');
    console.log('GPS51AuthService: Session logged out');
  }

  isAuthenticated(): boolean {
    if (!this.token) {
      return false;
    }
    
    const currentTime = Date.now();
    const expiryTime = this.token.expires_at.getTime();
    return currentTime < expiryTime;
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.token;
  }

  getUser() {
    return gps51Client.getUser();
  }

  getClient() {
    return gps51Client;
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();
