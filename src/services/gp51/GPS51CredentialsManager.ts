
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

  async getCredentials(): Promise<GPS51Credentials | null> {
    if (!this.credentials) {
      await this.loadCredentialsFromStorage();
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

  private async loadCredentialsFromStorage(): Promise<void> {
    try {
      // Always prioritize individual items for more reliable access
      let username = localStorage.getItem('gps51_username');
      let passwordHash = localStorage.getItem('gps51_password_hash');
      let apiUrl = localStorage.getItem('gps51_api_url');
      
      // If no credentials found, try default test credentials for demo purposes
      if (!username || !passwordHash || !apiUrl) {
        console.log('GPS51CredentialsManager: No stored credentials found, checking for demo credentials...');
        
        // Check for demo credentials in localStorage (commonly stored as "octopus")
        const demoUsername = localStorage.getItem('octopus');
        if (demoUsername) {
          console.log('GPS51CredentialsManager: Found demo credentials, using as default...');
          username = demoUsername;
          passwordHash = 'octopus'; // Will be hashed below
          apiUrl = 'https://api.gps51.com/openapi';
          
          // Save these as the default credentials
          localStorage.setItem('gps51_username', username);
          localStorage.setItem('gps51_api_url', apiUrl);
        }
      }
      
      if (username && passwordHash && apiUrl) {
        // Validate password is properly hashed
        const { GPS51Utils } = await import('../gps51/GPS51Utils');
        
        if (!GPS51Utils.validateMD5Hash(passwordHash)) {
          console.warn('GPS51CredentialsManager: Stored password is not a valid MD5 hash, re-hashing...');
          const hashedPassword = await GPS51Utils.ensureMD5Hash(passwordHash);
          localStorage.setItem('gps51_password_hash', hashedPassword);
          
          this.credentials = {
            username,
            password: hashedPassword,
            apiUrl,
            from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
            type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
            apiKey: localStorage.getItem('gps51_api_key') || undefined
          };
        } else {
          this.credentials = {
            username,
            password: passwordHash,
            apiUrl,
            from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
            type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
            apiKey: localStorage.getItem('gps51_api_key') || undefined
          };
        }
        
        console.log('GPS51CredentialsManager: Credentials restored from individual items with validation');
        return;
      }
      
      // Fallback: try JSON credentials but validate thoroughly
      const storedCreds = localStorage.getItem('gps51_credentials');
      if (storedCreds) {
        const creds = JSON.parse(storedCreds);
        
        // Check if this is just metadata (safe credentials without password)
        if (!creds.password && creds.username && username && passwordHash) {
          // Use individual items for actual credentials
          this.credentials = {
            username,
            password: passwordHash,
            apiUrl: apiUrl || creds.apiUrl,
            from: (localStorage.getItem('gps51_from') as 'WEB' | 'ANDROID' | 'IPHONE' | 'WEIXIN') || 'WEB',
            type: (localStorage.getItem('gps51_type') as 'USER' | 'DEVICE') || 'USER',
            apiKey: localStorage.getItem('gps51_api_key') || undefined
          };
          console.log('GPS51CredentialsManager: Credentials restored from mixed sources');
          return;
        }
        
        console.log('GPS51CredentialsManager: No valid credentials found in storage');
      }
      
      // As a last resort, provide default test credentials if none exist
      if (!this.credentials) {
        console.log('GPS51CredentialsManager: Setting up default test credentials...');
        const { GPS51Utils } = await import('../gps51/GPS51Utils');
        
        this.credentials = {
          username: 'octopus',
          password: await GPS51Utils.ensureMD5Hash('octopus'),
          apiUrl: 'https://api.gps51.com/openapi',
          from: 'WEB',
          type: 'USER'
        };
        
        // Save these default credentials
        this.saveCredentialsToStorage(this.credentials);
        console.log('GPS51CredentialsManager: Default test credentials configured');
      }
      
      console.log('GPS51CredentialsManager: Credentials loading completed');
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
