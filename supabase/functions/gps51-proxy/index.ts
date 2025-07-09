import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Import refactored modules
import { corsHeaders, handleCorsPreflightRequest, createCorsResponse } from './modules/cors-handler.ts';
import { validateRequest, getClientIP } from './modules/request-validator.ts';
import { buildGPS51URL, buildRequestOptions, makeGPS51Request } from './modules/gps51-client.ts';
import { processGPS51Response, createErrorResponse } from './modules/response-processor.ts';
import { checkRateLimit, recordRequest, handleRateLimitError } from './modules/rate-limiter.ts';
import { logApiCall } from './modules/logger.ts';
import type { GPS51ProxyRequest } from './modules/types.ts';

serve(async (req) => {
  const startTime = Date.now();
  const clientIP = getClientIP(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  try {
    console.log('GPS51 Proxy: Incoming request:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // Check rate limiter before proceeding
    const rateLimitResult = await checkRateLimit();
    if (!rateLimitResult.shouldAllow) {
      return createCorsResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: rateLimitResult.message,
          waitTime: rateLimitResult.waitTime,
          proxy_error: true,
          error_code: 'RATE_LIMITED'
        }),
        429
      );
    }

    if (req.method !== 'POST') {
      return createCorsResponse(
        JSON.stringify({ error: 'Only POST requests are supported' }),
        405
      );
    }

    const requestData: GPS51ProxyRequest = await req.json();
    console.log('GPS51 Proxy: Request data:', {
      action: requestData.action,
      hasToken: !!requestData.token,
      hasParams: !!requestData.params,
      method: requestData.method || 'POST',
      apiUrl: requestData.apiUrl || 'https://api.gps51.com/openapi'
    });

    // Validate request
    const validation = validateRequest(requestData);
    if (!validation.isValid) {
      return createCorsResponse(
        JSON.stringify({
          error: validation.error,
          proxy_error: true,
          error_code: requestData.action !== 'login' ? 'MISSING_TOKEN' : 'INVALID_REQUEST',
          action: requestData.action,
          suggestion: requestData.action !== 'login' ? 'Please authenticate first using the login action' : 'Check request parameters'
        }),
        requestData.action !== 'login' ? 401 : 400
      );
    }

    // Build GPS51 request
    const targetUrl = buildGPS51URL(requestData);
    const requestOptions = buildRequestOptions(requestData);

    console.log('GPS51 Proxy: Making request to GPS51 API:', {
      url: targetUrl.toString(),
      method: requestOptions.method,
      hasBody: !!requestOptions.body,
      headers: requestOptions.headers
    });

    try {
      // Make request to GPS51 API
      const { response, responseText, requestDuration } = await makeGPS51Request(targetUrl, requestOptions);
      
      // Process response
      const responseData = processGPS51Response(response, responseText, requestData, requestDuration, startTime);
      
      // ENHANCED: Advanced auth issue detection
      if (responseData.status === 8902) {
        console.error('GPS51 Proxy: 8902 Rate Limit Error Detected:', {
          action: requestData.action,
          message: responseData.message
        });
        await handleRateLimitError(requestData, requestDuration);
      }

      // ENHANCED: Detect permission issues for position data
      if (requestData.action === 'lastposition' && responseData.status === 0) {
        if (!responseData.records || responseData.records.length === 0) {
          console.warn('GPS51 Proxy: CRITICAL PERMISSION ISSUE DETECTED:', {
            action: requestData.action,
            status: responseData.status,
            message: responseData.message,
            hasRecords: !!responseData.records,
            recordsLength: responseData.records ? responseData.records.length : 0,
            analysis: 'Token valid for auth but lacks position data access rights',
            recommendation: 'Verify user permissions in GPS51 admin panel'
          });
          
          // Add metadata about the permission issue
          responseData.permissionIssueDetected = true;
          responseData.authAnalysis = {
            tokenValid: true,
            hasDataAccess: false,
            issueType: 'permission_denied',
            recommendation: 'Token authenticated successfully but lacks position data access rights'
          };
        }
      }

      console.log('GPS51 Proxy: Returning processed response:', {
        status: responseData.status,
        message: responseData.message,
        hasData: !!responseData.data,
        hasRecords: !!responseData.records,
        recordsLength: responseData.records ? responseData.records.length : 0,
        hasToken: !!responseData.token,
        totalDuration: responseData.proxy_metadata?.totalDuration,
        success: responseData.status === 0 || responseData.status === '0',
        permissionIssueDetected: !!responseData.permissionIssueDetected,
        authAnalysis: responseData.authAnalysis,
        timestamp: new Date().toISOString()
      });

      // Log successful API call to database
      await logApiCall(
        requestData.action,
        req.method,
        requestData,
        response.status,
        responseData,
        responseData.proxy_metadata?.totalDuration || 0,
        undefined,
        clientIP,
        req.headers.get('user-agent')
      );

      // Update rate limiter with request result
      await recordRequest(
        requestData,
        responseData.status === 0 || responseData.status === '0',
        responseData.proxy_metadata?.totalDuration || 0,
        responseData.status
      );

      return createCorsResponse(
        JSON.stringify(responseData),
        response.ok ? 200 : response.status
      );

    } catch (fetchError) {
      console.error('GPS51 Proxy: Fetch error:', fetchError);
      
      const fetchDuration = Date.now() - startTime;
      const errorResponse = createErrorResponse(
        fetchError instanceof Error ? fetchError : new Error('Unknown fetch error'),
        requestData,
        fetchDuration,
        targetUrl
      );

      // Log failed API call to database
      await logApiCall(
        requestData.action || 'unknown',
        req.method,
        requestData || {},
        502,
        null,
        fetchDuration,
        fetchError instanceof Error ? fetchError.message : 'Unknown fetch error',
        clientIP,
        req.headers.get('user-agent')
      );

      // Update rate limiter with failed request
      await recordRequest(requestData, false, fetchDuration, 502);
      
      return createCorsResponse(
        JSON.stringify({
          error: errorResponse.message,
          proxy_error: true,
          error_code: errorResponse.proxy_metadata?.responseType?.toUpperCase() || 'UNKNOWN_ERROR',
          timestamp: new Date().toISOString(),
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          fetchDuration: fetchDuration,
          targetUrl: targetUrl.toString(),
          requestAction: requestData.action
        }),
        502
      );
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('GPS51 Proxy: Error processing request:', error);
    
    // Log proxy processing error
    await logApiCall(
      'proxy-error',
      req.method,
      { method: req.method, hasBody: req.method === 'POST' },
      500,
      null,
      totalDuration,
      error instanceof Error ? error.message : 'Unknown proxy error',
      clientIP,
      req.headers.get('user-agent')
    );
    
    return createCorsResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown proxy error',
        proxy_error: true,
        error_code: 'PROXY_PROCESSING_ERROR',
        timestamp: new Date().toISOString(),
        totalDuration: totalDuration,
        requestDetails: {
          method: req.method,
          hasBody: req.method === 'POST'
        }
      }),
      500
    );
  }
});