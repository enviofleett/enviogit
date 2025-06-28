
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
  apiUrl: string; // Added apiUrl to credentials
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
      console.log('Authenticating with GPS51 using dynamic configuration...');
      
      // Call our edge function for authentication with dynamic config
      const { data, error } = await supabase.functions.invoke('gps51-auth', {
        body: {
          username: credentials.username,
          password: credentials.password,
          apiKey: credentials.apiKey,
          apiUrl: credentials.apiUrl
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      const token: GPS51AuthToken = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 3600,
        expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000)
      };

      this.token = token;
      this.credentials = credentials;
      
      // Store token and credentials in localStorage for persistence
      localStorage.setItem('gps51_token', JSON.stringify(token));
      localStorage.setItem('gps51_credentials', JSON.stringify({
        username: credentials.username,
        apiKey: credentials.apiKey,
        apiUrl: credentials.apiUrl
        // Note: We don't store password for security
      }));
      
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
      const currentTime = new Date().getTime(); // Fixed: use getTime() method
      const expiryTime = this.token.expires_at.getTime(); // Fixed: use getTime() method
      
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
      const storedPassword = localStorage.getItem('gps51_password'); // We'll need password for refresh
      
      if (storedCreds && storedPassword) {
        try {
          const creds = JSON.parse(storedCreds);
          this.credentials = {
            ...creds,
            password: storedPassword
          };
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
    localStorage.removeItem('gps51_credentials');
    localStorage.removeItem('gps51_password');
    console.log('GPS51 session logged out');
  }

  isAuthenticated(): boolean {
    return this.token !== null && new Date().getTime() < this.token.expires_at.getTime(); // Fixed: use getTime() method
  }

  getTokenInfo(): GPS51AuthToken | null {
    return this.token;
  }

  // Helper method to get stored credentials for sync operations
  getStoredCredentials(): GPS51Credentials | null {
    const storedCreds = localStorage.getItem('gps51_credentials');
    const storedPassword = localStorage.getItem('gps51_password');
    
    if (storedCreds && storedPassword) {
      try {
        const creds = JSON.parse(storedCreds);
        return {
          ...creds,
          password: storedPassword
        };
      } catch (e) {
        console.warn('Failed to parse stored GPS51 credentials');
      }
    }
    
    return null;
  }
}

export const gps51AuthService = GPS51AuthService.getInstance();
