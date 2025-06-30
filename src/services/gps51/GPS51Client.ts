
import { GPS51AuthCredentials, GPS51User, GPS51Device, GPS51Position, GPS51Group, GPS51ApiResponse } from './GPS51Types';
import { GPS51_STATUS, GPS51_DEFAULTS } from './GPS51Constants';
import { GPS51ApiClient } from './GPS51ApiClient';
import { GPS51AuthenticationManager, GPS51AuthResult } from './GPS51AuthenticationManager';
import { GPS51DeviceManager } from './GPS51DeviceManager';
import { GPS51PositionManager, GPS51PositionResult } from './GPS51PositionManager';
import { GPS51SessionManager } from './GPS51SessionManager';

export class GPS51Client {
  private apiClient: GPS51ApiClient;
  private authManager: GPS51AuthenticationManager;
  private deviceManager: GPS51DeviceManager;
  private positionManager: GPS51PositionManager;
  private sessionManager: GPS51SessionManager;

  constructor(baseURL = GPS51_DEFAULTS.BASE_URL) {
    this.apiClient = new GPS51ApiClient(baseURL);
    this.authManager = new GPS51AuthenticationManager(this.apiClient);
    this.deviceManager = new GPS51DeviceManager(this.apiClient);
    this.positionManager = new GPS51PositionManager(this.apiClient);
    this.sessionManager = new GPS51SessionManager();
  }

  async authenticate(credentials: GPS51AuthCredentials): Promise<{ success: boolean; user?: GPS51User; error?: string }> {
    const result: GPS51AuthResult = await this.authManager.authenticate(credentials);
    
    if (result.success && result.token) {
      this.sessionManager.setAuthData(result.token, result.user || null);
    }
    
    return {
      success: result.success,
      user: result.user,
      error: result.error
    };
  }

  async getDeviceList(): Promise<GPS51Device[]> {
    this.sessionManager.ensureAuthenticated();
    return this.deviceManager.getDeviceList(
      this.sessionManager.getToken()!,
      this.sessionManager.getUser()
    );
  }

  async getRealtimePositions(deviceids: string[] = [], lastQueryTime?: number): Promise<GPS51PositionResult> {
    this.sessionManager.ensureAuthenticated();
    return this.positionManager.getRealtimePositions(
      this.sessionManager.getToken()!,
      deviceids,
      lastQueryTime
    );
  }

  async refreshToken(): Promise<boolean> {
    const user = this.sessionManager.getUser();
    if (!user) {
      return false;
    }

    try {
      const response = await this.apiClient.makeRequest('querymonitorlist', this.sessionManager.getToken()!, { 
        username: user.username 
      });
      
      if (response.status === GPS51_STATUS.SUCCESS) {
        return true;
      } else if (response.status === GPS51_STATUS.TOKEN_INVALID) {
        this.sessionManager.logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }

    return false;
  }

  isAuthenticated(): boolean {
    return this.sessionManager.isAuthenticated();
  }

  getUser(): GPS51User | null {
    return this.sessionManager.getUser();
  }

  getToken(): string | null {
    return this.sessionManager.getToken();
  }

  logout(): void {
    this.sessionManager.logout();
    this.apiClient.resetRetryState();
  }
}

export const gps51Client = new GPS51Client();

// Re-export types for convenience
export type { GPS51AuthCredentials, GPS51User, GPS51Device, GPS51Position, GPS51Group, GPS51ApiResponse } from './GPS51Types';
