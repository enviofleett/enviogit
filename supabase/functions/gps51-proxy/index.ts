import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface GPS51ProxyRequest {
  action: string;
  token?: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  apiUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('GPS51 Proxy: Incoming request:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    });

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
    
    // Only add token for non-login actions
    if (requestData.token && requestData.action !== 'login') {
      targetUrl.searchParams.append('token', requestData.token);
    }

    // Add undocumented parameters for specific actions
    if (requestData.action === 'lastposition') {
      targetUrl.searchParams.append('streamtype', 'proto');
      targetUrl.searchParams.append('send', '2');
    }

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

    // Add body for POST requests - Use JSON for login, form-encoded for others
    if ((requestData.method || 'POST') === 'POST' && requestData.params) {
      if (requestData.action === 'login') {
        // Use JSON for login requests to OpenAPI endpoint
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/json'
        };
        requestOptions.body = JSON.stringify(requestData.params);
        
        console.log('GPS51 Proxy: Sending JSON login request:', {
          bodyParams: requestData.params,
          jsonBody: requestOptions.body
        });
      } else {
        // Use form-encoded for other requests
        requestOptions.headers = {
          ...requestOptions.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        
        const formParams = new URLSearchParams();
        Object.entries(requestData.params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            formParams.append(key, value.join(','));
          } else {
            formParams.append(key, String(value));
          }
        });
        requestOptions.body = formParams.toString();

        console.log('GPS51 Proxy: Sending form-encoded request:', {
          bodyParams: requestData.params,
          formBody: requestOptions.body
        });
      }
    }

    console.log('GPS51 Proxy: Making request to GPS51 API:', {
      url: targetUrl.toString(),
      method: requestOptions.method,
      hasBody: !!requestOptions.body
    });

    // Make request to GPS51 API with timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      requestOptions.signal = controller.signal;
      const response = await fetch(targetUrl.toString(), requestOptions);
      clearTimeout(timeoutId);
      
      const responseText = await response.text();

      console.log('GPS51 Proxy: GPS51 API response:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('Content-Type'),
        bodyLength: responseText.length,
        isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('[')
      });

      // Handle different response types
      let responseData: any;
      const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/octet-stream') || contentType.includes('binary')) {
      console.warn('GPS51 Proxy: Received binary response, may indicate parameter issues');
      
      if (responseText.length === 0) {
        responseData = {
          status: 1,
          message: 'Empty response received from GPS51 API',
          data: [],
          records: []
        };
      } else {
        // Try to parse as JSON despite content-type
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = {
            status: 0,
            message: 'Binary response received, cannot parse as JSON',
            data: responseText,
            proxy_info: {
              contentType,
              bodyLength: responseText.length,
              action: requestData.action
            }
          };
        }
      }
    } else {
      // Standard JSON response handling
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {
          status: 0,
          message: responseText || 'Empty response',
          data: responseText,
          proxy_info: {
            contentType,
            bodyLength: responseText.length,
            action: requestData.action
          }
        };
      }
    }

    // Add proxy metadata
    responseData.proxy_metadata = {
      processedAt: new Date().toISOString(),
      apiUrl: targetUrl.toString(),
      responseStatus: response.status,
      responseTime: Date.now()
    };

    console.log('GPS51 Proxy: Returning processed response:', {
      status: responseData.status,
      message: responseData.message,
      hasData: !!responseData.data,
      hasRecords: !!responseData.records
    });

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
      
      // Handle specific fetch errors
      let errorMessage = 'Request failed';
      if (fetchError.name === 'AbortError') {
        errorMessage = 'Request timeout - GPS51 API did not respond within 30 seconds';
      } else if (fetchError.message.includes('fetch')) {
        errorMessage = 'Network error - Unable to reach GPS51 API server';
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          proxy_error: true,
          timestamp: new Date().toISOString(),
          details: fetchError.message
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
    console.error('GPS51 Proxy: Error processing request:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown proxy error',
        proxy_error: true,
        timestamp: new Date().toISOString()
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