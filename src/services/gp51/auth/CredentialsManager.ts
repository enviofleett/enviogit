
import type { GPS51Credentials } from './types';

export class CredentialsManager {
  private credentials: GPS51Credentials | null = null;

  setCredentials(credentials: GPS51Credentials): void {
    this.credentials = credentials;
    this.storeCredentials(credentials);
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

  private storeCredentials(credentials: GPS51Credentials): void {
    // Store only safe credentials (without password for security)
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
        // Note: We don't store passwords, so refresh might not be possible
        // without re-authentication
        this.credentials = {
          username: creds.username,
          password: '', // Password not stored for security
          apiUrl: creds.apiUrl,
          from: creds.from || 'WEB',
          type: creds.type || 'USER'
        };
      } catch (e) {
        console.warn('Failed to parse stored GPS51 credentials');
      }
    }
  }
}
