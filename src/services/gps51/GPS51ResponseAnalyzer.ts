
/**
 * GPS51 Response Analyzer
 * Main orchestrator for comprehensive GPS51 API response analysis
 */

import { GPS51ResponseParser } from './GPS51ResponseParser';
import { GPS51ResponseValidator, StatusAnalysis, TokenAnalysis, FieldAnalysis } from './GPS51ResponseValidator';
import { GPS51ResponseLogger } from './GPS51ResponseLogger';

export interface AnalyzedResponse {
  status: StatusAnalysis;
  cause: FieldAnalysis;
  token: TokenAnalysis;
  message: FieldAnalysis;
  user: FieldAnalysis;
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
  
  // Step 1: Parse the response
  const parseResult = GPS51ResponseParser.parseResponse(apiResponseData);
  GPS51ResponseLogger.logParsingDetails(parseResult, context);
  
  if (!parseResult.success) {
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
  
  // Step 2: Get response metadata
  const metadata = GPS51ResponseParser.getResponseMetadata(parseResult.data);
  GPS51ResponseLogger.logResponseMetadata(metadata);
  
  // Step 3: Analyze all fields
  const statusAnalysis = GPS51ResponseValidator.analyzeStatus(parseResult.data);
  const causeAnalysis = GPS51ResponseValidator.analyzeCause(parseResult.data);
  const tokenAnalysis = GPS51ResponseValidator.analyzeToken(parseResult.data);
  const messageAnalysis = GPS51ResponseValidator.analyzeMessage(parseResult.data);
  const userAnalysis = GPS51ResponseValidator.analyzeUser(parseResult.data);
  
  // Step 4: Log field analyses
  GPS51ResponseLogger.logFieldAnalysis('STATUS', statusAnalysis);
  GPS51ResponseLogger.logFieldAnalysis('CAUSE', causeAnalysis);
  GPS51ResponseLogger.logFieldAnalysis('TOKEN', tokenAnalysis);
  GPS51ResponseLogger.logFieldAnalysis('MESSAGE', messageAnalysis);
  GPS51ResponseLogger.logFieldAnalysis('USER', userAnalysis);
  
  // Step 5: Log summary
  GPS51ResponseLogger.logAnalysisSummary(statusAnalysis, tokenAnalysis, causeAnalysis);
  
  console.log('=== END ANALYSIS ===\n');
  
  return {
    status: statusAnalysis,
    cause: causeAnalysis,
    token: tokenAnalysis,
    message: messageAnalysis,
    user: userAnalysis,
    rawResponse: parseResult.data,
    analysisTimestamp: new Date().toISOString(),
    responseKeys: metadata.responseKeys,
    responseSize: metadata.responseSize
  };
}

/**
 * Quick helper to log GPS51 response fields for debugging
 * @param response - GPS51 API response
 * @param context - Context string for logging
 */
export function quickLogGPS51Response(response: any, context: string = 'api-call'): void {
  GPS51ResponseLogger.quickLogResponse(response, context);
}

export default analyzeGPS51Response;
