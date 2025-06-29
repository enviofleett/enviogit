
import { gps51Client } from './GPS51Client';

export interface AuthCredentials {
  username: string;
  password: string;
  apiUrl: string;
  from: string;
  type: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
}

export class GPS51AuthService {
  private static instance: GPS51AuthService;
  private isAuthenticated = false;
  private authToken: string | null = null;

  private constructor() {}

  static getInstance(): GPS51AuthService {
    if (!GPS51AuthService.instance) {
      GPS51AuthService.instance = new GPS51AuthService();
    }
    return GPS51AuthService.instance;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      console.log('Authenticating with GPS51...');
      
      const response = await gps51Client.authenticate(
        credentials.username,
        credentials.password
      );

      if (response && response.success) {
        this.isAuthenticated = true;
        this.authToken = response.token || 'authenticated';
        
        console.log('GPS51 authentication successful');
        return {
          success: true,
          token: this.authToken
        };
      } else {
        console.error('GPS51 authentication failed:', response);
        return {
          success: false,
          error: response?.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('GPS51 authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      };
    }
  }

  isAuthenticatedState(): boolean {
    return this.isAuthenticated;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  logout(): void {
    this.isAuthenticated = false;
    this.authToken = null;
  }
}
