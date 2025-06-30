
import { md5 } from 'js-md5';

/**
 * GPS51 Password Utilities
 * Handles password hashing and validation for GPS51 API
 */
export class GPS51PasswordUtils {
  /**
   * Converts plain text password to MD5 hash (32-digit lowercase string)
   * @param plainPassword - The plain text password
   * @returns MD5 hash as lowercase string
   */
  static hashPassword(plainPassword: string): string {
    // Use js-md5 library to create MD5 hash
    const hashedPassword = md5(plainPassword).toLowerCase();
    
    console.log('GPS51PasswordUtils: Password hashing:', {
      originalLength: plainPassword.length,
      hashedLength: hashedPassword.length,
      isValidMD5Format: /^[a-f0-9]{32}$/.test(hashedPassword),
      hashedPreview: hashedPassword.substring(0, 8) + '...'
    });
    
    return hashedPassword;
  }

  /**
   * Validates if a string is a valid MD5 hash
   * @param hash - The hash to validate
   * @returns True if valid MD5 format
   */
  static isValidMD5(hash: string): boolean {
    return /^[a-f0-9]{32}$/.test(hash);
  }
}
