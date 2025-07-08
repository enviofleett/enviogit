
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
    const { username, password, apiUrl, action } = parsedRequest;

    // Enhanced validation with detailed logging
    if (!username || !password || !apiUrl) {
      logAuthAttempt('VALIDATION_FAILED', {
        requestId,
        hasUsername: !!username,
        hasPassword: !!password,
        hasApiUrl: !!apiUrl
      });
      throw new Error('Missing required authentication parameters: username, password, and apiUrl are required');
    }

    // Validate API URL format
    if (!apiUrl.includes('gps51.com') && !apiUrl.includes('localhost')) {
      logAuthAttempt('INVALID_API_URL', { requestId, apiUrl });
      throw new Error('Invalid GPS51 API URL format');
    }

    // Validate password is MD5 hashed (32 character hex string)
    const isMD5 = /^[a-f0-9]{32}$/i.test(password);
    logAuthAttempt('CREDENTIAL_VALIDATION', {
      requestId,
      username,
      apiUrl,
      passwordIsMD5: isMD5,
      passwordLength: password.length
    });

    // Prepare authentication request to GPS51 API
    const authPayload = {
      username,
      password,
      from: 'WEB',
      type: 'USER'
    };

    const requestUrl = action ? `${apiUrl}?action=${action}` : `${apiUrl}?action=login`;
    
    logAuthAttempt('GPS51_REQUEST_START', {
      requestId,
      url: requestUrl,
      payload: { ...authPayload, password: '[REDACTED]' }
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
        body: JSON.stringify(authPayload),
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
      if (authResult.status === 0 && authResult.token) {
        const response = {
          success: true,
          access_token: authResult.token,
          token_type: 'Bearer',
          expires_in: 24 * 60 * 60, // 24 hours
          user: authResult.user || { username },
          gps51_status: authResult.status,
          gps51_message: authResult.message
        };

        logAuthAttempt('SUCCESS', {
          requestId,
          username,
          hasToken: !!response.access_token,
          tokenLength: response.access_token?.length
        });

        return new Response(
          JSON.stringify(response),
          {
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
