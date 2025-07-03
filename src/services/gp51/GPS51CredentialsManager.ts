
export interface GPS51Credentials {
  username: string;
  password: string;
  apiKey?: string;
  apiUrl: string;
  from?: 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN';
  type?: 'USER' | 'DEVICE';
}

export class GPS51CredentialsManager {
  private credentials: GPS51Credentials | null = null;

  setCredentials(credentials: GPS51Credentials): void {
    this.credentials = credentials;
    this.saveCredentialsToStorage(credentials);
  }

  getCredentials(): GPS51Credentials | null {
    if (!this.credentials) {
      this.loadCredentialsFromStorage();
    }
    
    // Validate that we have a complete credentials object
    if (this.credentials && (!this.credentials.username || !this.credentials.password || !this.credentials.apiUrl)) {
      console.warn('GPS51CredentialsManager: Incomplete credentials found, clearing...');
      this.clearCredentials();
      return null;
    }
    
    return this.credentials;
  }

  clearCredentials(): void {
    this.credentials = null;
    localStorage.removeItem('gps51_credentials');
    localStorage.removeItem('gps51_password_hash');
    localStorage.removeItem('gps51_username');
    localStorage.removeItem('gps51_api_url');
    localStorage.removeItem('gps51_from');
    localStorage.removeItem('gps51_type');
    localStorage.removeItem('gps51_api_key');
  }

  private saveCredentialsToStorage(credentials: GPS51Credentials): void {
    try {
      // Store individual items for easy access
      localStorage.setItem('gps51_api_url', credentials.apiUrl);
      localStorage.setItem('gps51_username', credentials.username);
      localStorage.setItem('gps51_password_hash', credentials.password); // Store the hashed password
      localStorage.setItem('gps51_from', credentials.from || 'WEB');
      localStorage.setItem('gps51_type', credentials.type || 'USER');
      
      if (credentials.apiKey) {
        localStorage.setItem('gps51_api_key', credentials.apiKey);
      }

      // Store complete credentials object for restoration
      const safeCredentials = {
        username: credentials.username,
        password: credentials.password, // This is already hashed
        apiUrl: credentials.apiUrl,
        from: credentials.from || 'WEB',
        type: credentials.type || 'USER',
        apiKey: credentials.apiKey
      };
      
      localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
      
      console.log('GPS51CredentialsManager: Credentials saved to localStorage');
    } catch (error) {
      console.error('GPS51CredentialsManager: Failed to save credentials:', error);
    }
  }

  private loadCredentialsFromStorage(): void {
    try {
      const storedCreds = localStorage.getItem('gps51_credentials');
      
      if (storedCreds) {
        const creds = JSON.parse(storedCreds);
        
        // Validate required fields before creating credentials object
        if (!creds.username || !creds.password || !creds.apiUrl) {
          console.warn('GPS51CredentialsManager: Stored credentials missing required fields');
          return;
        }
        
        this.credentials = {
          username: creds.username,
          password: creds.password, // This should be the hashed password
          apiUrl: creds.apiUrl,
          from: creds.from || 'WEB',
          type: creds.type || 'USER',
          apiKey: creds.apiKey
        };
        
        console.log('GPS51CredentialsManager: Credentials restored from localStorage');
      } else {
        // Fallback: try to load from individual items
        const username = localStorage.getItem('gps51_username');
        const passwordHash = localStorage.getItem('gps51_password_hash');
        const apiUrl = localStorage.getItem('gps51_api_url');
        
        if (username && passwordHash && apiUrl) {
          this.credentials = {
            username,
            password: passwordHash,
            apiUrl,
            from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
            type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
            apiKey: localStorage.getItem('gps51_api_key') || undefined
          };
          
          console.log('GPS51CredentialsManager: Credentials restored from individual items');
        } else {
          console.log('GPS51CredentialsManager: No valid credentials found in storage');
        }
      }
    } catch (error) {
      console.warn('GPS51CredentialsManager: Failed to load credentials from localStorage:', error);
      this.credentials = null;
    }
  }

  hasStoredCredentials(): boolean {
    return !!(localStorage.getItem('gps51_credentials') || 
              (localStorage.getItem('gps51_username') && 
               localStorage.getItem('gps51_password_hash') && 
               localStorage.getItem('gps51_api_url')));
  }
}
