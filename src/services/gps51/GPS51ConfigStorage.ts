
export interface GPS51StoredConfig {
  apiUrl: string;
  username: string;
  password: string;
  from: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type: 'USER' | 'DEVICE';
}

export class GPS51ConfigStorage {
  private readonly STORAGE_KEY = 'gps51_config';

  /**
   * Get configuration from localStorage
   */
  getStoredConfig(): GPS51StoredConfig | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        console.log('GPS51ConfigStorage: Found config in localStorage');
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('GPS51ConfigStorage: Could not parse localStorage config:', error);
    }
    return null;
  }

  /**
   * Save configuration to localStorage
   */
  saveStoredConfig(config: GPS51StoredConfig): void {
    try {
      // Ensure API URL uses the new openapi endpoint
      const updatedConfig = {
        ...config,
        apiUrl: config.apiUrl.replace('/webapi', '/openapi')
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedConfig));
      console.log('GPS51ConfigStorage: Successfully saved to localStorage');
    } catch (error) {
      console.warn('GPS51ConfigStorage: Could not save to localStorage:', error);
      throw error;
    }
  }

  /**
   * Clear stored configuration
   */
  clearStoredConfig(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('GPS51ConfigStorage: Configuration cleared from localStorage');
    } catch (error) {
      console.warn('GPS51ConfigStorage: Could not clear localStorage:', error);
    }
  }

  /**
   * Check if configuration exists in storage
   */
  hasStoredConfig(): boolean {
    return !!this.getStoredConfig();
  }
}

export const gps51ConfigStorage = new GPS51ConfigStorage();
