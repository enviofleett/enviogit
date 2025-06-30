
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
    return this.credentials;
  }

  clearCredentials(): void {
    this.credentials = null;
    localStorage.removeItem('gps51_credentials');
  }

  private saveCredentialsToStorage(credentials: GPS51Credentials): void {
    // Store non-sensitive credentials only
    const safeCredentials = {
      username: credentials.username,
      apiUrl: credentials.apiUrl,
      from: credentials.from,
      type: credentials.type
    };
    localStorage.setItem('gps51_credentials', JSON.stringify(safeCredentials));
  }

  private loadCredentialsFromStorage(): void {
    const storedCreds = localStorage.getItem('gps51_credentials');
    
    if (storedCreds) {
      try {
        const creds = JSON.parse(storedCreds);
        // Note: We don't store passwords, so this will be incomplete
        this.credentials = {
          username: creds.username,
          password: '', // Password not stored for security
          apiUrl: creds.apiUrl,
          from: creds.from,
          type: creds.type
        };
      } catch (e) {
        console.warn('Failed to parse stored GPS51 credentials');
      }
    }
  }
}
