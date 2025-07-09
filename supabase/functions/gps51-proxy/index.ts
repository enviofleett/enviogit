import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Initialize Supabase client for database logging
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface GPS51ProxyRequest {
  action: string;
  token?: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  apiUrl?: string;
}

serve(async (req) => {
  const startTime = Date.now();
  const clientIP = req.headers.get('cf-connecting-ip') || 
                   req.headers.get('x-forwarded-for') || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const logApiCall = async (
    endpoint: string,
    requestPayload: any,
    responseStatus: number,
    responseBody: any,
    durationMs: number,
    errorMessage?: string
  ) => {
    try {
      await supabase.from('api_calls_monitor').insert({
        endpoint: `GPS51-EdgeFunction-${endpoint}`,
        method: req.method,
        request_payload: {
          ...requestPayload,
          clientIP,
          userAgent: req.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        },
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: durationMs,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log API call to database:', logError);
    }
  };

  try {
    console.log('GPS51 Proxy: Incoming request:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString()
    });

    // Check rate limiter before proceeding
    try {
      const rateLimitCheck = await supabase.functions.invoke('gps51-rate-limiter', {
        body: { action: 'check_limits' }
      });

      if (rateLimitCheck.data && !rateLimitCheck.data.shouldAllow) {
        console.warn('GPS51 Proxy: Request blocked by rate limiter:', rateLimitCheck.data);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: rateLimitCheck.data.message,
            waitTime: rateLimitCheck.data.waitTime,
            proxy_error: true,
            error_code: 'RATE_LIMITED'
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } catch (rateLimitError) {
      console.warn('GPS51 Proxy: Rate limiter check failed, proceeding without rate limiting:', rateLimitError);
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Only POST requests are supported' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
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

    // Validate required fields
    if (!requestData.action) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: action' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build GPS51 API URL
    const apiUrl = requestData.apiUrl || 'https://api.gps51.com/openapi';
    const targetUrl = new URL(apiUrl);
    targetUrl.searchParams.append('action', requestData.action);
    
    // CRITICAL FIX: Enhanced token validation for all actions except login
    if (requestData.action !== 'login') {
      if (!requestData.token || requestData.token === 'no-token' || requestData.token.trim() === '') {
        console.error('GPS51 Proxy: Missing or invalid token for authenticated action:', {
          action: requestData.action,
          tokenProvided: !!requestData.token,
          tokenValue: requestData.token ? `${requestData.token.substring(0, 10)}...` : 'null'
        });
        
        return new Response(
          JSON.stringify({
            error: 'Authentication required - no valid token provided',
            proxy_error: true,
            error_code: 'MISSING_TOKEN',
            action: requestData.action,
            suggestion: 'Please authenticate first using the login action'
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      targetUrl.searchParams.append('token', requestData.token);
      console.log('GPS51 Proxy: Added valid token parameter:', { 
        action: requestData.action, 
        hasToken: !!requestData.token,
        tokenLength: requestData.token.length,
        tokenPrefix: requestData.token.substring(0, 10) + '...'
      });
    }

    // NOTE: No additional URL parameters needed for lastposition - GPS51 API expects clean URL

    // Prepare request options with enhanced headers
    const requestOptions: RequestInit = {
      method: requestData.method || 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; GPS51-Proxy/1.0)',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };

    // Add body for POST requests - Use JSON for all actions (GPS51 API expects JSON)
    if ((requestData.method || 'POST') === 'POST' && requestData.params) {
      // Use JSON for all requests to GPS51 OpenAPI endpoint
      requestOptions.headers = {
        ...requestOptions.headers,
        'Content-Type': 'application/json'
      };
      requestOptions.body = JSON.stringify(requestData.params);
      
      console.log('GPS51 Proxy: Sending JSON request:', {
        action: requestData.action,
        bodyParams: requestData.params,
        jsonBody: requestOptions.body,
        endpoint: targetUrl.toString()
      });
    }

    console.log('GPS51 Proxy: Making request to GPS51 API:', {
      url: targetUrl.toString(),
      method: requestOptions.method,
      hasBody: !!requestOptions.body,
      headers: requestOptions.headers
    });

    // Make request to GPS51 API with enhanced timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      requestOptions.signal = controller.signal;
      const requestStartTime = Date.now();
      
      console.log('GPS51 Proxy: Starting fetch request:', {
        url: targetUrl.toString(),
        startTime: new Date(requestStartTime).toISOString(),
        timeout: '30s'
      });
      
      const response = await fetch(targetUrl.toString(), requestOptions);
      clearTimeout(timeoutId);
      
      const requestDuration = Date.now() - requestStartTime;
      console.log('GPS51 Proxy: Fetch completed:', {
        status: response.status,
        statusText: response.statusText,
        duration: `${requestDuration}ms`,
        url: targetUrl.toString()
      });
      
      const responseText = await response.text();

    console.log('GPS51 Proxy: GPS51 API response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('Content-Type'),
      bodyLength: responseText.length,
      isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('['),
      responsePreview: responseText.substring(0, 200)
    });

    // PRODUCTION FIX: Enhanced response handling with better error recovery
    let responseData: any;
    const contentType = response.headers.get('Content-Type') || '';
    
    console.log('GPS51 Proxy: Processing response content:', {
      contentType,
      responseLength: responseText.length,
      isEmpty: responseText.trim().length === 0
    });
  
    // Handle binary/octet-stream responses (often indicates API parameter issues)
    if (contentType.includes('application/octet-stream') || contentType.includes('binary')) {
      console.warn('GPS51 Proxy: Received binary response - investigating parameter compatibility');
      
      if (responseText.length === 0) {
        // Empty binary response - return structured empty result
        responseData = {
          status: 0, // Success status to prevent cascade failures
          message: 'Empty response received - possibly no data available for query',
          records: [],
          data: [],
          lastquerypositiontime: Date.now(), // Provide current timestamp to prevent query loops
          proxy_metadata: {
            responseType: 'empty_binary',
            action: requestData.action,
            parameterDiagnostic: 'Parameters may be correct but no data available'
          }
        };
      } else {
        // Non-empty binary response - try parsing as JSON
        try {
          responseData = JSON.parse(responseText);
          console.log('GPS51 Proxy: Binary response parsed as JSON successfully');
        } catch {
          // Binary content is not JSON - return structured error
          responseData = {
            status: 1,
            message: 'Binary response cannot be parsed as JSON - check API parameters',
            data: responseText.substring(0, 1000), // Truncate large responses
            proxy_metadata: {
              responseType: 'unparseable_binary',
              contentType,
              bodyLength: responseText.length,
              action: requestData.action,
              suggestion: 'Verify API endpoint and parameter format compatibility'
            }
          };
        }
      }
    } else {
      // Standard JSON response handling with enhanced error recovery
      try {
        if (responseText.trim() === '') {
          // Empty string response
          responseData = {
            status: 0,
            message: 'Empty response from GPS51 API',
            records: [],
            data: [],
            lastquerypositiontime: Date.now()
          };
        } else {
          responseData = JSON.parse(responseText);
          
          // Normalize status field to ensure consistent integer type
          if (responseData.status !== undefined) {
            responseData.status = parseInt(responseData.status) || 0;
          }
          
          // CRITICAL: Handle 8902 rate limit error immediately
          if (responseData.status === 8902) {
            console.error('GPS51 Proxy: 8902 Rate Limit Error Detected:', {
              action: requestData.action,
              message: responseData.message,
              cause: responseData.cause
            });
            
            // Immediately update rate limiter about 8902 error
            try {
              await supabase.functions.invoke('gps51-rate-limiter', {
                body: {
                  action: 'record_request',
                  action_type: requestData.action,
                  success: false,
                  responseTime: requestDuration,
                  status: 8902
                }
              });
            } catch (rateLimitUpdateError) {
              console.warn('Failed to update rate limiter about 8902 error:', rateLimitUpdateError);
            }
          }
          
          // Add lastquerypositiontime if missing (critical for position queries)
          if (requestData.action === 'lastposition' && !responseData.lastquerypositiontime) {
            responseData.lastquerypositiontime = Date.now();
            console.log('GPS51 Proxy: Added missing lastquerypositiontime for position query');
          }
          
          console.log('GPS51 Proxy: Successfully parsed JSON response:', {
            status: responseData.status,
            hasToken: !!responseData.token,
            hasUser: !!responseData.user,
            hasRecords: !!responseData.records,
            recordsLength: Array.isArray(responseData.records) ? responseData.records.length : 0,
            hasLastQueryTime: !!responseData.lastquerypositiontime,
            message: responseData.message
          });
        }
        
      } catch (parseError) {
        console.error('GPS51 Proxy: JSON parsing failed:', parseError);
        
        // PRODUCTION FIX: Return structured error instead of failing completely
        responseData = {
          status: 1,
          message: 'Failed to parse GPS51 API response as JSON',
          cause: parseError.message,
          data: responseText.substring(0, 500), // Include sample for debugging
          proxy_metadata: {
            responseType: 'parse_error',
            contentType,
            bodyLength: responseText.length,
            action: requestData.action,
            parseError: parseError.message,
            suggestion: 'Check GPS51 API response format or endpoint compatibility'
          }
        };
      }
    }

    // Add proxy metadata with enhanced timing
    const totalDuration = Date.now() - startTime;
    responseData.proxy_metadata = {
      processedAt: new Date().toISOString(),
      apiUrl: targetUrl.toString(),
      responseStatus: response.status,
      responseTime: Date.now(),
      requestDuration: requestDuration,
      totalDuration: totalDuration,
      proxyVersion: '2.0'
    };

      console.log('GPS51 Proxy: Returning processed response:', {
        status: responseData.status,
        message: responseData.message,
        hasData: !!responseData.data,
        hasRecords: !!responseData.records,
        hasToken: !!responseData.token,
        totalDuration: totalDuration,
        success: responseData.status === 0 || responseData.status === '0'
      });

      // Log successful API call to database
      await logApiCall(
        requestData.action,
        requestData,
        response.status,
        responseData,
        totalDuration
      );

      // Update rate limiter with successful request
      try {
        await supabase.functions.invoke('gps51-rate-limiter', {
          body: {
            action: 'record_request',
            action_type: requestData.action,
            success: responseData.status === 0 || responseData.status === '0',
            responseTime: totalDuration,
            status: responseData.status
          }
        });
      } catch (rateLimitError) {
        console.warn('GPS51 Proxy: Failed to update rate limiter:', rateLimitError);
      }

      return new Response(
        JSON.stringify(responseData),
        {
          status: response.ok ? 200 : response.status,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          }
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      console.error('GPS51 Proxy: Fetch error:', fetchError);
      
      // Handle specific fetch errors with enhanced debugging
      const fetchDuration = Date.now() - startTime;
      
      // Log failed API call to database
      await logApiCall(
        requestData?.action || 'unknown',
        requestData || {},
        502,
        null,
        fetchDuration,
        fetchError.message
      );

      // Update rate limiter with failed request
      try {
        await supabase.functions.invoke('gps51-rate-limiter', {
          body: {
            action: 'record_request',
            action_type: requestData?.action || 'unknown',
            success: false,
            responseTime: fetchDuration,
            status: 502
          }
        });
      } catch (rateLimitError) {
        console.warn('GPS51 Proxy: Failed to update rate limiter with failure:', rateLimitError);
      }
      let errorMessage = 'Request failed';
      let errorCode = 'UNKNOWN_ERROR';
      
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Request timeout - GPS51 API did not respond within 30 seconds';
        errorCode = 'REQUEST_TIMEOUT';
      } else if (fetchError.message.includes('fetch')) {
        errorMessage = 'Network error - Unable to reach GPS51 API server';
        errorCode = 'NETWORK_ERROR';
      } else if (fetchError.message.includes('DNS')) {
        errorMessage = 'DNS resolution failed for GPS51 API server';
        errorCode = 'DNS_ERROR';
      } else if (fetchError.message.includes('SSL') || fetchError.message.includes('TLS')) {
        errorMessage = 'SSL/TLS connection error to GPS51 API server';
        errorCode = 'SSL_ERROR';
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          proxy_error: true,
          error_code: errorCode,
          timestamp: new Date().toISOString(),
          details: fetchError.message,
          fetchDuration: fetchDuration,
          targetUrl: targetUrl.toString(),
          requestAction: requestData.action
        }),
        {
          status: 502,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          }
        }
      );
    }

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error('GPS51 Proxy: Error processing request:', error);
    
    // Log proxy processing error
    await logApiCall(
      'proxy-error',
      { method: req.method, hasBody: req.method === 'POST' },
      500,
      null,
      totalDuration,
      error instanceof Error ? error.message : 'Unknown proxy error'
    );
    
    return new Response(
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
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    );
  }
});