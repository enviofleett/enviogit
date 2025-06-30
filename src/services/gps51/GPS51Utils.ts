
export class GPS51Utils {
  static generateToken(): string {
    // Generate a proper random token using crypto
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static validateMD5Hash(password: string): boolean {
    // Check if password is a valid MD5 hash (32 lowercase hex characters)
    const md5Regex = /^[a-f0-9]{32}$/;
    return md5Regex.test(password);
  }

  static normalizeApiUrl(apiUrl: string): string {
    if (apiUrl.includes('www.gps51.com')) {
      console.warn('Correcting API URL from www.gps51.com to api.gps51.com');
      return apiUrl.replace('www.gps51.com', 'api.gps51.com').replace('/webapi', '/openapi');
    } else if (apiUrl.includes('/webapi')) {
      console.warn('Migrating API URL from /webapi to /openapi endpoint');
      return apiUrl.replace('/webapi', '/openapi');
    }
    return apiUrl;
  }

  static getPasswordValidationInfo(password: string) {
    return {
      isValidMD5: this.validateMD5Hash(password),
      passwordLength: password.length,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSpecialChars: /[^a-zA-Z0-9]/.test(password)
    };
  }
}
