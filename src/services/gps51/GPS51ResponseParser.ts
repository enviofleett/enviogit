
/**
 * GPS51 Response Parser
 * Handles JSON parsing and basic response validation
 */

export interface ParsedResponse {
  success: boolean;
  data: any;
  error?: string;
  inputType: 'string' | 'object' | 'invalid';
  rawInput: any;
}

export class GPS51ResponseParser {
  /**
   * Parses GPS51 API response data
   * @param apiResponseData - Raw response data (string or object)
   * @returns Parsed response with metadata
   */
  static parseResponse(apiResponseData: string | any): ParsedResponse {
    let parsedData: any;
    let inputType: 'string' | 'object' | 'invalid';
    
    try {
      if (typeof apiResponseData === 'string') {
        inputType = 'string';
        parsedData = JSON.parse(apiResponseData);
      } else if (typeof apiResponseData === 'object' && apiResponseData !== null) {
        inputType = 'object';
        parsedData = apiResponseData;
      } else {
        inputType = 'invalid';
        throw new Error(`Invalid input type: ${typeof apiResponseData}`);
      }
      
      return {
        success: true,
        data: parsedData,
        inputType,
        rawInput: apiResponseData
      };
    } catch (parseError) {
      return {
        success: false,
        data: null,
        error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        inputType: inputType!,
        rawInput: apiResponseData
      };
    }
  }

  /**
   * Gets basic response metadata
   * @param data - Parsed response data
   * @returns Response metadata
   */
  static getResponseMetadata(data: any) {
    const responseKeys = Object.keys(data || {});
    const responseSize = JSON.stringify(data).length;
    
    return {
      responseKeys,
      responseSize,
      keyCount: responseKeys.length,
      isObject: typeof data === 'object',
      isArray: Array.isArray(data)
    };
  }
}
