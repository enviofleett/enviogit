
import { supabase } from '@/integrations/supabase/client';

export interface GPS51AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: Date;
}

export interface GPS51Credentials {
  username: string;
  password: string;
  apiKey: string;
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
      console.log('Authenticating with GPS51...');
      
      // Call our edge function for authentication
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: credentials
      });

      if (error) throw error;

      const token: GPS51AuthToken = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 3600,
        expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000)
      };

      this.token = token;
      this.credentials = credentials;
      
      // Store token in localStorage for persistence
      localStorage.setItem('gps51_token', JSON.stringify(token));
      
      console.log('GPS51 authentication successful');
      return token;

    } catch (error) {
      console.error('GPS51 authentication failed:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getValidToken(): Promise<string | null> {
    // Try to load token from localStorage if not in memory
    if (!this.token) {
      const storedToken = localStorage.getItem('gps51_token');
      if (storedToken) {
        try {
          this.token = JSON.parse(storedToken);
          // Convert expires_at string back to Date object
          if (this.token) {
            this.token.expires_at = new Date(this.token.expires_at);
          }
        } catch (e) {
          console.warn('Failed to parse stored GPS51 token');
          localStorage.removeItem('gps51_token');
        }
      }
    }

    // Check if token exists and is still valid
    if (this.token) {
      const currentTime = new Date().getTime();
      const expiryTime = this.token.expires_at.getTime();
      
      if (currentTime >= expiryTime) {
        console.log('GPS51 token expired, clearing...');
        this.token = null;
        localStorage.removeItem('gps51_token');
        return null;
      }

      return this.token.access_token;
    }

    return null;
  }

  async refreshToken(): Promise<GPS51AuthToken | null> {
    if (!this.credentials) {
      console.warn('No stored credentials for GPS51 token refresh');
      return null;
    }

    try {
      return await this.authenticate(this.credentials);
    } catch (error) {
      console.error('Failed to refresh GPS51 token:', error);
      return null;
    }
  }

  logout(): void {
    this.token = null;
    this.credentials = null;
    localStorage.removeItem('gps51_token');
    console.log('GPS51 session logged out');
  }

  isAuthenticated(): boolean {
    return this.token !== null && new Date().getTime() < this.token.expires_at.getTime();
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.token;
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();
