import type { GPS51ProxyRequest } from './types.ts';

export function validateRequest(requestData: GPS51ProxyRequest): { isValid: boolean; error?: string } {
  if (!requestData.action) {
    return { isValid: false, error: 'Missing required field: action' };
  }

  // Enhanced token validation for all actions except login
  if (requestData.action !== 'login') {
    if (!requestData.token || requestData.token === 'no-token' || requestData.token.trim() === '') {
      console.error('GPS51 Proxy: Missing or invalid token for authenticated action:', {
        action: requestData.action,
        tokenProvided: !!requestData.token,
        tokenValue: requestData.token ? `${requestData.token.substring(0, 10)}...` : 'null'
      });
      
      return { 
        isValid: false, 
        error: 'Authentication required - no valid token provided' 
      };
    }
  }

  return { isValid: true };
}

export function getClientIP(request: Request): string {
  return request.headers.get('cf-connecting-ip') || 
         request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         'unknown';
}