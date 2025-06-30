
/**
 * GPS51 Response Field Validator
 * Validates and analyzes specific response fields
 */

export interface FieldAnalysis {
  found: boolean;
  value: any;
  type: string;
  isValid?: boolean;
}

export interface StatusAnalysis extends FieldAnalysis {
  isSuccess: boolean;
}

export interface TokenAnalysis extends FieldAnalysis {
  isValid: boolean;
  length?: number;
}

export class GPS51ResponseValidator {
  /**
   * Analyzes the STATUS field
   * @param data - Parsed response data
   * @returns Status field analysis
   */
  static analyzeStatus(data: any): StatusAnalysis {
    const statusAnalysis: StatusAnalysis = {
      found: 'status' in data,
      value: data.status ?? null,
      type: typeof data.status,
      isSuccess: false
    };
    
    if (statusAnalysis.found) {
      // GPS51 success is typically status: 0
      statusAnalysis.isSuccess = statusAnalysis.value === 0;
    }
    
    return statusAnalysis;
  }

  /**
   * Analyzes the CAUSE field
   * @param data - Parsed response data
   * @returns Cause field analysis
   */
  static analyzeCause(data: any): FieldAnalysis {
    return {
      found: 'cause' in data,
      value: data.cause ?? null,
      type: typeof data.cause
    };
  }

  /**
   * Analyzes the TOKEN field
   * @param data - Parsed response data
   * @returns Token field analysis
   */
  static analyzeToken(data: any): TokenAnalysis {
    const tokenAnalysis: TokenAnalysis = {
      found: 'token' in data,
      value: data.token ?? null,
      type: typeof data.token,
      isValid: false
    };
    
    if (tokenAnalysis.found) {
      const tokenLength = typeof tokenAnalysis.value === 'string' ? tokenAnalysis.value.length : 0;
      tokenAnalysis.isValid = typeof tokenAnalysis.value === 'string' && tokenLength > 0;
      tokenAnalysis.length = tokenLength;
    }
    
    return tokenAnalysis;
  }

  /**
   * Analyzes the MESSAGE field
   * @param data - Parsed response data
   * @returns Message field analysis
   */
  static analyzeMessage(data: any): FieldAnalysis {
    return {
      found: 'message' in data,
      value: data.message ?? null,
      type: typeof data.message
    };
  }

  /**
   * Analyzes the USER field
   * @param data - Parsed response data
   * @returns User field analysis
   */
  static analyzeUser(data: any): FieldAnalysis {
    const userAnalysis: FieldAnalysis = {
      found: 'user' in data,
      value: data.user ?? null,
      type: typeof data.user
    };
    
    return userAnalysis;
  }

  /**
   * Gets possible error issues based on status code
   * @param statusValue - Status code value
   * @returns Array of possible issues
   */
  static getPossibleIssues(statusValue: any): string[] {
    const issues: string[] = [];
    
    if (statusValue === 1) {
      issues.push('Invalid credentials');
    } else if (statusValue === 8901) {
      issues.push('Parameter validation failed');
    } else if (statusValue === 8903) {
      issues.push('Account locked/rate limited');
    } else if (statusValue === null || statusValue === undefined) {
      issues.push('Malformed response');
    }
    
    return issues;
  }
}
