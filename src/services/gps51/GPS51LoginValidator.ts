
/**
 * GPS51 Login Parameters Interface
 */
export interface GPS51LoginParams {
  username: string;
  plainPassword: string;
  from: string; // e.g., 'WEB', 'ANDROID', 'IPHONE', 'WEIXIN'
  type: string; // e.g., 'USER', 'DEVICE'
}

/**
 * GPS51 Login Parameter Validator
 * Validates login parameters before API calls
 */
export class GPS51LoginValidator {
  /**
   * Validates login parameters
   * @param params - Login parameters to validate
   * @throws Error if validation fails
   */
  static validateParams(params: GPS51LoginParams): void {
    if (!params.username || params.username.trim() === '') {
      throw new Error('Username is required and cannot be empty');
    }
    
    if (!params.plainPassword || params.plainPassword.trim() === '') {
      throw new Error('Password is required and cannot be empty');
    }
    
    if (!params.from || params.from.trim() === '') {
      throw new Error('From parameter is required (e.g., WEB, ANDROID, IPHONE, WEIXIN)');
    }
    
    if (!params.type || params.type.trim() === '') {
      throw new Error('Type parameter is required (e.g., USER, DEVICE)');
    }
  }
}
