
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GPS51AuthRequest {
  username: string;
  password: string;
  apiUrl: string;
  action?: string;
  from?: string;
  type?: string;
  deviceids?: string[];
  lastquerypositiontime?: number;
  token?: string;
}

interface GPS51ApiResponse {
  status: number;
  message?: string;
  cause?: string;
  token?: string;
  user?: any;
}

// Enhanced logging function
function logAuthAttempt(stage: string, data: any) {
  console.log(`[GPS51-AUTH-${stage}]`, {
    timestamp: new Date().toISOString(),
    stage,
    ...data
  });
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logAuthAttempt('REQUEST_START', { requestId });

    const requestBody = await req.text();
    if (!requestBody) {
      logAuthAttempt('ERROR_EMPTY_BODY', { requestId });
      throw new Error('Empty request body received');
    }

    logAuthAttempt('PARSING_REQUEST', { requestId, bodyLength: requestBody.length });

    const parsedRequest: GPS51AuthRequest = JSON.parse(requestBody);
    const { username, password, apiUrl, action, from, type, deviceids, lastquerypositiontime, token } = parsedRequest;

    // Enhanced validation with detailed logging
    if (action === 'login' && (!username || !password || !apiUrl)) {
      logAuthAttempt('VALIDATION_FAILED', {
        requestId,
        hasUsername: !!username,
        hasPassword: !!password,
        hasApiUrl: !!apiUrl
      });
      throw new Error('Missing required authentication parameters: username, password, and apiUrl are required');
    }
    
    if ((action === 'querymonitorlist' || action === 'lastposition') && (!token || !apiUrl)) {
      logAuthAttempt('VALIDATION_FAILED', {
        requestId,
        hasToken: !!token,
        hasApiUrl: !!apiUrl,
        action
      });
      throw new Error('Missing required parameters: token and apiUrl are required for this action');
    }

    // Validate API URL format
    if (!apiUrl.includes('gps51.com') && !apiUrl.includes('localhost')) {
      logAuthAttempt('INVALID_API_URL', { requestId, apiUrl });
      throw new Error('Invalid GPS51 API URL format');
    }

    // Validate password is MD5 hashed (32 character hex string) for login actions
    if (action === 'login' || !action) {
      const isMD5 = /^[a-f0-9]{32}$/i.test(password);
      logAuthAttempt('CREDENTIAL_VALIDATION', {
        requestId,
        username,
        apiUrl,
        passwordIsMD5: isMD5,
        passwordLength: password.length,
        action: action || 'login'
      });
    }

    // Prepare request payload based on action
    let requestPayload: any = {};
    
    if (action === 'login' || !action) {
      requestPayload = {
        username,
        password,
        from: from || 'WEB',
        type: type || 'USER'
      };
    } else if (action === 'querymonitorlist') {
      requestPayload = {
        username,
        token
      };
    } else if (action === 'lastposition') {
      requestPayload = {
        deviceids: deviceids || [],
        lastquerypositiontime: lastquerypositiontime || undefined,
        token
      };
    }

    const requestUrl = action ? `${apiUrl}?action=${action}` : `${apiUrl}?action=login`;
    
    logAuthAttempt('GPS51_REQUEST_START', {
      requestId,
      url: requestUrl,
      payload: { ...requestPayload, password: '[REDACTED]' },
      action: action || 'login'
    });

    // Make authentication request to GPS51 with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const gps51Response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Envio-GPS51-Client/1.0'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      logAuthAttempt('GPS51_RESPONSE_RECEIVED', {
        requestId,
        status: gps51Response.status,
        statusText: gps51Response.statusText,
        contentType: gps51Response.headers.get('content-type')
      });

      // Handle non-JSON responses
      const contentType = gps51Response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const textResponse = await gps51Response.text();
        logAuthAttempt('NON_JSON_RESPONSE', {
          requestId,
          responseText: textResponse.substring(0, 500)
        });
        throw new Error(`GPS51 API returned non-JSON response: ${textResponse.substring(0, 100)}`);
      }

      const authResult: GPS51ApiResponse = await gps51Response.json();

      logAuthAttempt('GPS51_PARSED_RESPONSE', {
        requestId,
        status: authResult.status,
        hasToken: !!authResult.token,
        hasUser: !!authResult.user,
        message: authResult.message,
        cause: authResult.cause
      });

      // GPS51 returns status 0 for success
      if (authResult.status === 0) {
        let response: any = {
          success: true,
          gps51_status: authResult.status,
          gps51_message: authResult.message
        };

        // Handle different action types
        if (action === 'login' || !action) {
          if (!authResult.token) {
            logAuthAttempt('LOGIN_NO_TOKEN', {
              requestId,
              status: authResult.status,
              message: authResult.message
            });
            throw new Error('Login successful but no token received');
          }
          
          response = {
            ...response,
            status: 0, // GPS51 success status for compatibility
            access_token: authResult.token,
            token: authResult.token, // Add for compatibility
            token_type: 'Bearer',
            expires_in: 24 * 60 * 60, // 24 hours
            user: authResult.user || { username },
            data: authResult.user || { username } // Additional data field
          };
        } else if (action === 'querymonitorlist') {
          response = {
            ...response,
            status: 0, // GPS51 success status
            groups: authResult.groups || [],
            devices: authResult.devices || [],
            data: authResult.groups || authResult.devices || []
          };
        } else if (action === 'lastposition') {
          response = {
            ...response,
            status: 0, // GPS51 success status
            records: authResult.records || [],
            lastquerypositiontime: authResult.lastquerypositiontime,
            data: authResult.records || []
          };
        }

        logAuthAttempt('SUCCESS', {
          requestId,
          action: action || 'login',
          hasToken: !!(response.access_token),
          hasTokenAlias: !!(response.token),
          hasGroups: !!(response.groups),
          hasRecords: !!(response.records),
          recordCount: response.records?.length || 0,
          tokenValue: response.access_token ? '[PRESENT]' : '[MISSING]'
        });

        return new Response(
          JSON.stringify(response),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        // Map GPS51 error codes to meaningful messages
        let errorMessage = authResult.message || authResult.cause || 'Authentication failed';
        
        switch (authResult.status) {
          case 1:
            errorMessage = 'Invalid username or password';
            break;
          case 8901:
            errorMessage = 'Invalid request parameters';
            break;
          case 9999:
            errorMessage = 'GPS51 server error';
            break;
        }

        logAuthAttempt('GPS51_AUTH_FAILED', {
          requestId,
          status: authResult.status,
          originalMessage: authResult.message,
          mappedMessage: errorMessage
        });

        throw new Error(errorMessage);
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        logAuthAttempt('TIMEOUT_ERROR', { requestId });
        throw new Error('GPS51 API request timeout - please try again');
      }
      
      logAuthAttempt('FETCH_ERROR', {
        requestId,
        error: fetchError.message,
        name: fetchError.name
      });
      
      throw new Error(`GPS51 API connection failed: ${fetchError.message}`);
    }

  } catch (error) {
    logAuthAttempt('GENERAL_ERROR', {
      requestId,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    // Return structured error response
    const errorResponse = {
      success: false,
      error: error.message,
      error_code: 'AUTH_FAILED',
      timestamp: new Date().toISOString(),
      request_id: requestId
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 200, // Always return 200 to avoid CORS issues
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
