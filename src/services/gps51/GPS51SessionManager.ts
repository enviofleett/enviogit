import { GPS51CredentialsManager } from '../gp51/GPS51CredentialsManager';
import { GPS51AuthStateManager } from './GPS51AuthStateManager';
import { gps51Client } from './GPS51Client';

/**
 * Manages GPS51 session persistence and restoration
 */
export class GPS51SessionManager {
  private authStateManager: GPS51AuthStateManager;
  private credentialsManager: GPS51CredentialsManager;

  constructor(authStateManager: GPS51AuthStateManager, credentialsManager: GPS51CredentialsManager) {
    this.authStateManager = authStateManager;
    this.credentialsManager = credentialsManager;
  }

  /**
   * Initialize authentication on startup with enhanced persistence
   */
  async initializeAuthentication(): Promise<boolean> {
    try {
      console.log('GPS51SessionManager: Initializing enhanced authentication on startup...');

      // Check for stored token first
      const storedToken = localStorage.getItem('gps51_auth_token');
      if (storedToken) {
        console.log('GPS51SessionManager: Found stored token, attempting to restore session...');

        const sessionRestored = await this.restoreSession(storedToken);
        if (sessionRestored) {
          return true;
        }
      }

      // No valid stored token, attempt fresh authentication
      return await this.attemptFreshAuthentication();
    } catch (error) {
      console.error('GPS51SessionManager: Authentication initialization failed:', error);
      this.authStateManager.clearAuthenticationState();
      return false;
    }
  }

  /**
   * Restore session from stored token
   */
  private async restoreSession(storedToken: string): Promise<boolean> {
    try {
      // Get credentials and try to restore session
      const credentials = await this.credentialsManager.getCredentials();
      if (!credentials) {
        console.log('GPS51SessionManager: No credentials available for session restoration');
        return false;
      }

      // Set token in client first  
      gps51Client.setAuthenticationState(storedToken, null);

      // Test if the token is still valid by making a simple request
      const deviceList = await gps51Client.getDeviceList();

      if (deviceList && deviceList.length >= 0) {
        // Token is valid, restore full auth state
        const user = gps51Client.getUser();
        this.authStateManager.setAuthenticationState(storedToken, user);

        console.log('GPS51SessionManager: Session restored successfully from stored token');

        // Dispatch authentication success event
        this.authStateManager.dispatchAuthenticationEvent(storedToken, user, 'session_restore');

        return true;
      }

      return false;
    } catch (error) {
      console.log('GPS51SessionManager: Stored token validation failed:', error);
      this.authStateManager.clearAuthenticationState();
      return false;
    }
  }

  /**
   * Attempt fresh authentication
   */
  private async attemptFreshAuthentication(): Promise<boolean> {
    const credentials = await this.credentialsManager.getCredentials();
    if (!credentials) {
      console.log('GPS51SessionManager: No stored credentials found');
      return false;
    }

    console.log('GPS51SessionManager: Attempting fresh authentication with enhanced validation...');
    // This would typically call the authentication core, but we'll handle this in the main service
    return false; // Let the main service handle fresh authentication
  }

  /**
   * Check if session restoration is needed
   */
  shouldRestoreSession(): boolean {
    const status = this.authStateManager.getAuthenticationStatus();
    const tokenFromStorage = !!localStorage.getItem('gps51_auth_token');

    return !status.diagnostics.internalAuth && tokenFromStorage;
  }

  /**
   * Trigger background session restoration
   */
  triggerBackgroundRestoration(): void {
    if (this.shouldRestoreSession()) {
      console.log('GPS51SessionManager: Detected session restoration needed');
      this.initializeAuthentication().catch(error => {
        console.error('GPS51SessionManager: Background session restoration failed:', error);
      });
    }
  }
}