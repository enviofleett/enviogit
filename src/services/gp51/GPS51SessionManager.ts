
import * as md5 from 'js-md5';

interface SessionData {
  token: string;
  expires_at: Date;
  user_data?: any;
}

interface LoginCredentials {
  username: string;
  password: string;
  apiUrl: string;
}

export class GPS51SessionManager {
  private static instance: GPS51SessionManager;
  private sessionData: SessionData | null = null;
  private readonly SESSION_KEY = 'gps51_session';

  private constructor() {}

  static getInstance(): GPS51SessionManager {
    if (!GPS51SessionManager.instance) {
      GPS51SessionManager.instance = new GPS51SessionManager();
    }
    return GPS51SessionManager.instance;
  }

  async createSession(credentials: LoginCredentials): Promise<boolean> {
    try {
      // Ensure password is properly MD5 hashed
      const hashedPassword = this.ensurePasswordHash(credentials.password);
      
      const loginData = {
        username: credentials.username,
        password: hashedPassword,
        apiUrl: credentials.apiUrl
      };

      // Store session data
      this.sessionData = {
        token: this.generateSessionToken(),
        expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)), // 24 hours
        user_data: loginData
      };

      // Persist to localStorage
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
      
      return true;
    } catch (error) {
      console.error('Failed to create GPS51 session:', error);
      return false;
    }
  }

  private ensurePasswordHash(password: string): string {
    // Check if password is already MD5 hashed (32 character hex string)
    if (password.length === 32 && /^[a-f0-9]+$/i.test(password)) {
      return password.toLowerCase();
    }
    
    // Hash the password using MD5
    return md5.md5(password);
  }

  private generateSessionToken(): string {
    return md5.md5(Date.now().toString() + Math.random().toString());
  }

  getSession(): SessionData | null {
    if (this.sessionData) {
      // Check if session is still valid
      if (new Date().getTime() >= this.sessionData.expires_at.getTime()) {
        this.clearSession();
        return null;
      }
      return this.sessionData;
    }

    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.expires_at = new Date(parsed.expires_at);
        
        if (new Date().getTime() >= parsed.expires_at.getTime()) {
          this.clearSession();
          return null;
        }
        
        this.sessionData = parsed;
        return this.sessionData;
      }
    } catch (error) {
      console.error('Failed to load GPS51 session:', error);
    }

    return null;
  }

  isSessionValid(): boolean {
    const session = this.getSession();
    return session !== null;
  }

  clearSession(): void {
    this.sessionData = null;
    localStorage.removeItem(this.SESSION_KEY);
  }

  refreshSession(): boolean {
    if (this.sessionData) {
      this.sessionData.expires_at = new Date(Date.now() + (24 * 60 * 60 * 1000));
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.sessionData));
      return true;
    }
    return false;
  }
}

export const gps51SessionManager = GPS51SessionManager.getInstance();
