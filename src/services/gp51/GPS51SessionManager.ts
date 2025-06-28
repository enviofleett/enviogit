
import { md5 } from 'js-md5';

export interface SessionData {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  isActive: boolean;
}

export class GPS51SessionManager {
  private static instance: GPS51SessionManager;
  private sessionData: SessionData | null = null;
  private token: string | null = null;
  private lastSyncTime: Date | null = null;

  static getInstance(): GPS51SessionManager {
    if (!GPS51SessionManager.instance) {
      GPS51SessionManager.instance = new GPS51SessionManager();
    }
    return GPS51SessionManager.instance;
  }

  async initialize(accessToken: string): Promise<void> {
    this.token = accessToken;
    
    // Generate session ID using MD5 hash
    const sessionId = md5(`${accessToken}_${Date.now()}`);
    
    this.sessionData = {
      sessionId,
      userId: 'gps51_user', // Would be dynamic in real implementation
      lastActivity: new Date(),
      isActive: true
    };

    console.log('GPS51 Session Manager initialized');
  }

  async isConnected(): Promise<boolean> {
    return this.sessionData?.isActive && this.token !== null;
  }

  async syncData(): Promise<void> {
    if (!await this.isConnected()) {
      throw new Error('Session not connected');
    }

    try {
      // In a real implementation, this would sync with GPS51 API
      console.log('Syncing GPS51 data...');
      this.lastSyncTime = new Date();
      
      if (this.sessionData) {
        this.sessionData.lastActivity = new Date();
      }
    } catch (error) {
      console.error('GPS51 sync failed:', error);
      throw error;
    }
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  getSessionData(): SessionData | null {
    return this.sessionData;
  }

  cleanup(): void {
    this.sessionData = null;
    this.token = null;
    this.lastSyncTime = null;
    console.log('GPS51 Session Manager cleaned up');
  }
}
