
/**
 * GPS51 Response Logger
 * Handles detailed logging and debugging output
 */

import { GPS51ResponseValidator } from './GPS51ResponseValidator';
import { GPS51ResponseParser } from './GPS51ResponseParser';

export class GPS51ResponseLogger {
  /**
   * Logs detailed parsing information
   * @param parseResult - Result from GPS51ResponseParser
   * @param context - Context string for logging
   */
  static logParsingDetails(parseResult: any, context: string): void {
    if (parseResult.inputType === 'string') {
      console.log('Input type: JSON string');
      console.log('Raw response length:', parseResult.rawInput.length);
      console.log('Raw response preview:', parseResult.rawInput.substring(0, 200) + (parseResult.rawInput.length > 200 ? '...' : ''));
      
      if (parseResult.success) {
        console.log('JSON parsing: SUCCESS');
      } else {
        console.error('JSON parsing failed:', parseResult.error);
        console.error('Raw data that failed to parse:', parseResult.rawInput);
      }
    } else if (parseResult.inputType === 'object') {
      console.log('Input type: Parsed object');
    } else {
      console.error('Invalid input type:', parseResult.inputType);
    }
  }

  /**
   * Logs response metadata
   * @param metadata - Response metadata
   */
  static logResponseMetadata(metadata: any): void {
    console.log('Response keys found:', metadata.responseKeys);
    console.log('Response size (bytes):', metadata.responseSize);
    console.log('Response structure:', {
      isObject: metadata.isObject,
      isArray: metadata.isArray,
      keyCount: metadata.keyCount
    });
  }

  /**
   * Logs field analysis results
   * @param fieldName - Name of the field
   * @param analysis - Field analysis result
   */
  static logFieldAnalysis(fieldName: string, analysis: any): void {
    if (analysis.found) {
      console.log(`${fieldName} field analysis:`, {
        value: analysis.value,
        type: analysis.type,
        ...(analysis.length !== undefined && { length: analysis.length }),
        ...(analysis.isValid !== undefined && { isValid: analysis.isValid }),
        ...(analysis.isSuccess !== undefined && { isSuccess: analysis.isSuccess })
      });
      
      // Special handling for token preview
      if (fieldName === 'TOKEN' && typeof analysis.value === 'string') {
        console.log(`${fieldName} preview:`, analysis.value.substring(0, 10) + '...');
      }
      
      // Special handling for user object
      if (fieldName === 'USER' && typeof analysis.value === 'object' && analysis.value !== null) {
        console.log(`${fieldName} details:`, {
          keys: Object.keys(analysis.value),
          hasUsername: analysis.value.username !== undefined,
          hasUsertype: analysis.value.usertype !== undefined
        });
      }
    } else {
      const isOptional = fieldName === 'MESSAGE' || fieldName === 'USER';
      if (isOptional) {
        console.log(`${fieldName} field: not found (optional)`);
      } else {
        console.warn(`${fieldName} field: NOT FOUND`);
      }
    }
  }

  /**
   * Logs analysis summary
   * @param statusAnalysis - Status analysis result
   * @param tokenAnalysis - Token analysis result
   * @param causeAnalysis - Cause analysis result
   */
  static logAnalysisSummary(statusAnalysis: any, tokenAnalysis: any, causeAnalysis: any): void {
    console.log('=== ANALYSIS SUMMARY ===');
    console.log('Success indicators:', {
      statusFound: statusAnalysis.found,
      statusIsSuccess: statusAnalysis.isSuccess,
      tokenFound: tokenAnalysis.found,
      tokenIsValid: tokenAnalysis.isValid,
      overallSuccess: statusAnalysis.isSuccess && (tokenAnalysis.found ? tokenAnalysis.isValid : true)
    });
    
    if (!statusAnalysis.isSuccess) {
      const possibleIssues = GPS51ResponseValidator.getPossibleIssues(statusAnalysis.value);
      console.warn('FAILURE ANALYSIS:', {
        status: statusAnalysis.value,
        cause: causeAnalysis.value,
        possibleIssues
      });
    }
  }

  /**
   * Quick logging helper for basic response info
   * @param response - GPS51 API response
   * @param context - Context string for logging
   */
  static quickLogResponse(response: any, context: string = 'api-call'): void {
    console.log(`=== QUICK GPS51 LOG (${context}) ===`);
    console.log('Status:', response?.status, '(type:', typeof response?.status, ')');
    console.log('Cause:', response?.cause);
    console.log('Token:', response?.token ? 'Present (length: ' + response.token.length + ')' : 'Missing');
    console.log('Message:', response?.message);
    console.log('User:', response?.user ? 'Present' : 'Missing');
    console.log('All keys:', Object.keys(response || {}));
  }
}
