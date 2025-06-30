
/**
 * GPS51 Response Analyzer
 * Comprehensive tool for analyzing and debugging GPS51 API responses
 */

export interface AnalyzedResponse {
  status: {
    found: boolean;
    value: number | null;
    type: string;
    isSuccess: boolean;
  };
  cause: {
    found: boolean;
    value: string | null;
    type: string;
  };
  token: {
    found: boolean;
    value: string | null;
    type: string;
    isValid: boolean;
  };
  message: {
    found: boolean;
    value: string | null;
    type: string;
  };
  user: {
    found: boolean;
    value: any | null;
    type: string;
  };
  rawResponse: any;
  analysisTimestamp: string;
  responseKeys: string[];
  responseSize: number;
}

/**
 * Analyzes GPS51 API response and extracts key information
 * @param apiResponseData - JSON string or parsed JSON object from GPS51 API
 * @param context - Optional context string for logging (e.g., 'login', 'device-list')
 * @returns Analyzed response object with detailed field information
 */
export function analyzeGPS51Response(
  apiResponseData: string | any, 
  context: string = 'unknown'
): AnalyzedResponse {
  console.log(`=== GPS51 RESPONSE ANALYZER (${context.toUpperCase()}) ===`);
  console.log('Analysis timestamp:', new Date().toISOString());
  
  let parsedData: any;
  
  // Step 1: Parse the response if it's a string
  try {
    if (typeof apiResponseData === 'string') {
      console.log('Input type: JSON string');
      console.log('Raw response length:', apiResponseData.length);
      console.log('Raw response preview:', apiResponseData.substring(0, 200) + (apiResponseData.length > 200 ? '...' : ''));
      
      parsedData = JSON.parse(apiResponseData);
      console.log('JSON parsing: SUCCESS');
    } else if (typeof apiResponseData === 'object' && apiResponseData !== null) {
      console.log('Input type: Parsed object');
      parsedData = apiResponseData;
    } else {
      console.error('Invalid input type:', typeof apiResponseData);
      throw new Error(`Invalid input type: ${typeof apiResponseData}`);
    }
  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    console.error('Raw data that failed to parse:', apiResponseData);
    
    return {
      status: { found: false, value: null, type: 'undefined', isSuccess: false },
      cause: { found: false, value: 'JSON parse error', type: 'error' },
      token: { found: false, value: null, type: 'undefined', isValid: false },
      message: { found: false, value: null, type: 'undefined' },
      user: { found: false, value: null, type: 'undefined' },
      rawResponse: apiResponseData,
      analysisTimestamp: new Date().toISOString(),
      responseKeys: [],
      responseSize: 0
    };
  }
  
  // Step 2: Basic response analysis
  const responseKeys = Object.keys(parsedData || {});
  const responseSize = JSON.stringify(parsedData).length;
  
  console.log('Response keys found:', responseKeys);
  console.log('Response size (bytes):', responseSize);
  console.log('Response structure:', {
    isObject: typeof parsedData === 'object',
    isArray: Array.isArray(parsedData),
    keyCount: responseKeys.length
  });
  
  // Step 3: Extract and analyze STATUS field
  const statusAnalysis = {
    found: 'status' in parsedData,
    value: parsedData.status ?? null,
    type: typeof parsedData.status,
    isSuccess: false
  };
  
  if (statusAnalysis.found) {
    console.log('STATUS field analysis:', {
      value: statusAnalysis.value,
      type: statusAnalysis.type,
      isNumber: typeof statusAnalysis.value === 'number',
      isZero: statusAnalysis.value === 0,
      isOne: statusAnalysis.value === 1
    });
    
    // GPS51 success is typically status: 0
    statusAnalysis.isSuccess = statusAnalysis.value === 0;
  } else {
    console.warn('STATUS field: NOT FOUND');
  }
  
  // Step 4: Extract and analyze CAUSE field
  const causeAnalysis = {
    found: 'cause' in parsedData,
    value: parsedData.cause ?? null,
    type: typeof parsedData.cause
  };
  
  if (causeAnalysis.found) {
    console.log('CAUSE field analysis:', {
      value: causeAnalysis.value,
      type: causeAnalysis.type,
      length: typeof causeAnalysis.value === 'string' ? causeAnalysis.value.length : 0,
      isOK: causeAnalysis.value === 'OK'
    });
  } else {
    console.warn('CAUSE field: NOT FOUND');
  }
  
  // Step 5: Extract and analyze TOKEN field
  const tokenAnalysis = {
    found: 'token' in parsedData,
    value: parsedData.token ?? null,
    type: typeof parsedData.token,
    isValid: false
  };
  
  if (tokenAnalysis.found) {
    const tokenLength = typeof tokenAnalysis.value === 'string' ? tokenAnalysis.value.length : 0;
    tokenAnalysis.isValid = typeof tokenAnalysis.value === 'string' && tokenLength > 0;
    
    console.log('TOKEN field analysis:', {
      found: true,
      type: tokenAnalysis.type,
      length: tokenLength,
      isValid: tokenAnalysis.isValid,
      preview: typeof tokenAnalysis.value === 'string' ? 
        tokenAnalysis.value.substring(0, 10) + '...' : tokenAnalysis.value
    });
  } else {
    console.warn('TOKEN field: NOT FOUND');
  }
  
  // Step 6: Extract and analyze MESSAGE field
  const messageAnalysis = {
    found: 'message' in parsedData,
    value: parsedData.message ?? null,
    type: typeof parsedData.message
  };
  
  if (messageAnalysis.found) {
    console.log('MESSAGE field analysis:', {
      value: messageAnalysis.value,
      type: messageAnalysis.type,
      length: typeof messageAnalysis.value === 'string' ? messageAnalysis.value.length : 0
    });
  } else {
    console.log('MESSAGE field: not found (optional)');
  }
  
  // Step 7: Extract and analyze USER field
  const userAnalysis = {
    found: 'user' in parsedData,
    value: parsedData.user ?? null,
    type: typeof parsedData.user
  };
  
  if (userAnalysis.found) {
    console.log('USER field analysis:', {
      type: userAnalysis.type,
      isObject: typeof userAnalysis.value === 'object',
      keys: typeof userAnalysis.value === 'object' && userAnalysis.value !== null ? 
        Object.keys(userAnalysis.value) : [],
      hasUsername: userAnalysis.value?.username !== undefined,
      hasUsertype: userAnalysis.value?.usertype !== undefined
    });
  } else {
    console.log('USER field: not found (optional)');
  }
  
  // Step 8: Final analysis summary
  const analysis: AnalyzedResponse = {
    status: statusAnalysis,
    cause: causeAnalysis,
    token: tokenAnalysis,
    message: messageAnalysis,
    user: userAnalysis,
    rawResponse: parsedData,
    analysisTimestamp: new Date().toISOString(),
    responseKeys,
    responseSize
  };
  
  console.log('=== ANALYSIS SUMMARY ===');
  console.log('Success indicators:', {
    statusFound: statusAnalysis.found,
    statusIsSuccess: statusAnalysis.isSuccess,
    tokenFound: tokenAnalysis.found,
    tokenIsValid: tokenAnalysis.isValid,
    overallSuccess: statusAnalysis.isSuccess && (tokenAnalysis.found ? tokenAnalysis.isValid : true)
  });
  
  if (!statusAnalysis.isSuccess) {
    console.warn('FAILURE ANALYSIS:', {
      status: statusAnalysis.value,
      cause: causeAnalysis.value,
      possibleIssues: [
        statusAnalysis.value === 1 ? 'Invalid credentials' : null,
        statusAnalysis.value === 8901 ? 'Parameter validation failed' : null,
        statusAnalysis.value === 8903 ? 'Account locked/rate limited' : null,
        !statusAnalysis.found ? 'Malformed response' : null
      ].filter(Boolean)
    });
  }
  
  console.log('=== END ANALYSIS ===\n');
  
  return analysis;
}

/**
 * Quick helper to log GPS51 response fields for debugging
 * @param response - GPS51 API response
 * @param context - Context string for logging
 */
export function quickLogGPS51Response(response: any, context: string = 'api-call'): void {
  console.log(`=== QUICK GPS51 LOG (${context}) ===`);
  console.log('Status:', response?.status, '(type:', typeof response?.status, ')');
  console.log('Cause:', response?.cause);
  console.log('Token:', response?.token ? 'Present (length: ' + response.token.length + ')' : 'Missing');
  console.log('Message:', response?.message);
  console.log('User:', response?.user ? 'Present' : 'Missing');
  console.log('All keys:', Object.keys(response || {}));
}

export default analyzeGPS51Response;
