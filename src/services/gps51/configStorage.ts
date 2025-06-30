
import { GPS51Config, GPS51StoredCredentials } from './interfaces';

export class GPS51ConfigStorage {
  static saveConfiguration(config: GPS51Config): void {
    try {
      console.log('GPS51ConfigStorage: Saving configuration...');
      
      // Migrate old webapi endpoint to new openapi endpoint
      let apiUrl = config.apiUrl;
      if (apiUrl.includes('/webapi')) {
        console.warn('GPS51ConfigStorage: Migrating from deprecated /webapi to /openapi endpoint');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
      }

      // Store configuration in localStorage with consistent keys
      const configData = {
        apiUrl: apiUrl,
        username: config.username,
        from: config.from || 'WEB',
        type: config.type || 'USER',
        apiKey: config.apiKey || '',
        savedAt: new Date().toISOString()
      };

      // Save individual items for backward compatibility
      localStorage.setItem('gps51_api_url', configData.apiUrl);
      localStorage.setItem('gps51_username', configData.username);
      localStorage.setItem('gps51_password_hash', config.password);
      localStorage.setItem('gps51_from', configData.from);
      localStorage.setItem('gps51_type', configData.type);
      
      if (configData.apiKey) {
        localStorage.setItem('gps51_api_key', configData.apiKey);
      }

      // Store safe credentials for auth service
      const safeCredentials: GPS51StoredCredentials = {
        username: configData.username,
        apiUrl: configData.apiUrl,
        from: configData.from,
        type: configData.type,
        hasApiKey: !!configData.apiKey,
        savedAt: configData.savedAt
      };
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));

      console.log('GPS51ConfigStorage: Configuration saved successfully:', {
        keys: Object.keys(configData),
        hasPassword: !!config.password,
        savedItems: Object.keys(localStorage).filter(k => k.startsWith('gps51_'))
      });
    } catch (error) {
      console.error('GPS51ConfigStorage: Failed to save configuration:', error);
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static getConfiguration(): GPS51Config | null {
    try {
      let apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const passwordHash = localStorage.getItem('gps51_password_hash');
      const apiKey = localStorage.getItem('gps51_api_key');
      const from = localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
      const type = localStorage.getItem('gps51_type') as 'USER' | 'DEVICE';

      // Migrate old webapi endpoint to new openapi endpoint
      if (apiUrl && apiUrl.includes('/webapi')) {
        console.warn('GPS51ConfigStorage: Auto-migrating stored API URL from /webapi to /openapi');
        apiUrl = apiUrl.replace('/webapi', '/openapi');
        localStorage.setItem('gps51_api_url', apiUrl);
      }

      if (apiUrl && username) {
        const config = {
          apiUrl: apiUrl,
          username,
          password: passwordHash || '',
          apiKey: apiKey || undefined,
          from: from || 'WEB',
          type: type || 'USER'
        };
        
        console.log('GPS51ConfigStorage: Retrieved configuration:', {
          hasApiUrl: !!config.apiUrl,
          hasUsername: !!config.username,
          hasPassword: !!config.password,
          hasApiKey: !!config.apiKey,
          from: config.from,
          type: config.type,
          usingNewEndpoint: config.apiUrl.includes('/openapi')
        });
        
        return config;
      }
    } catch (error) {
      console.error('GPS51ConfigStorage: Failed to load configuration:', error);
    }

    return null;
  }

  static clearConfiguration(): void {
    const keysToRemove = [
      'gps51_api_url',
      'gps51_username', 
      'gps51_password_hash',
      'gps51_api_key',
      'gps51_from',
      'gps51_type',
      'gps51_credentials'
    ];
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('GPS51ConfigStorage: Configuration cleared, removed keys:', keysToRemove);
  }

  static isConfigured(): boolean {
    const config = GPS51ConfigStorage.getConfiguration();
    const isConfigured = !!(config?.apiUrl && config?.username && config?.password);
    
    console.log('GPS51ConfigStorage: Configuration check:', {
      hasConfig: !!config,
      hasApiUrl: !!config?.apiUrl,
      hasUsername: !!config?.username,
      hasPassword: !!config?.password,
      isConfigured
    });
    
    return isConfigured;
  }
}
