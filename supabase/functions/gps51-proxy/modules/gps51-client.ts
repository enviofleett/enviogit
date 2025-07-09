import type { GPS51ProxyRequest } from './types.ts';

export function buildGPS51URL(requestData: GPS51ProxyRequest): URL {
  const apiUrl = requestData.apiUrl || 'https://api.gps51.com/openapi';
  const targetUrl = new URL(apiUrl);
  targetUrl.searchParams.append('action', requestData.action);
  
  // Add token for authenticated actions
  if (requestData.action !== 'login' && requestData.token) {
    targetUrl.searchParams.append('token', requestData.token);
    console.log('GPS51 Proxy: Added valid token parameter:', { 
      action: requestData.action, 
      hasToken: !!requestData.token,
      tokenLength: requestData.token.length,
      tokenPrefix: requestData.token.substring(0, 10) + '...'
    });
  }

  return targetUrl;
}

export function buildRequestOptions(requestData: GPS51ProxyRequest): RequestInit {
  const requestOptions: RequestInit = {
    method: requestData.method || 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; GPS51-Proxy/1.0)',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  };

  // Add body for POST requests - Use JSON for all actions
  if ((requestData.method || 'POST') === 'POST' && requestData.params) {
    let bodyParams = requestData.params;
    
    if (requestData.action === 'lastposition') {
      // ENHANCED: Ensure correct parameter structure for lastposition with better validation
      bodyParams = {
        username: String(bodyParams.username || ''),
        deviceids: Array.isArray(bodyParams.deviceids) 
          ? bodyParams.deviceids 
          : (bodyParams.deviceids ? String(bodyParams.deviceids).split(',').map(id => id.trim()) : []),
        lastquerypositiontime: Number(bodyParams.lastquerypositiontime) || 0
      };
      
      console.log('GPS51 Proxy: ENHANCED - Fixed lastposition parameters:', {
        username: bodyParams.username,
        deviceids: bodyParams.deviceids,
        deviceidsType: Array.isArray(bodyParams.deviceids) ? 'array' : typeof bodyParams.deviceids,
        deviceidsCount: Array.isArray(bodyParams.deviceids) ? bodyParams.deviceids.length : 0,
        lastquerypositiontime: bodyParams.lastquerypositiontime,
        lastquerypositiontimeType: typeof bodyParams.lastquerypositiontime,
        isInitialFetch: bodyParams.lastquerypositiontime === 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Enhanced logging for all actions to track token usage
    if (requestData.action !== 'login') {
      console.log('GPS51 Proxy: ENHANCED - Token usage tracking:', {
        action: requestData.action,
        hasToken: !!requestData.token,
        tokenLength: requestData.token ? requestData.token.length : 0,
        tokenPrefix: requestData.token ? requestData.token.substring(0, 10) + '...' : 'none',
        username: bodyParams.username,
        timestamp: new Date().toISOString()
      });
    }
    
    requestOptions.headers = {
      ...requestOptions.headers,
      'Content-Type': 'application/json'
    };
    requestOptions.body = JSON.stringify(bodyParams);
    
    // ENHANCED: Add comprehensive request debugging
    console.log('GPS51 Proxy: ENHANCED - Complete request details:', {
      action: requestData.action,
      url: requestData.apiUrl || 'https://api.gps51.com/openapi',
      method: requestData.method || 'POST',
      headers: requestOptions.headers,
      bodyParams: bodyParams,
      jsonBody: requestOptions.body,
      bodySize: requestOptions.body.length,
      hasToken: !!requestData.token,
      requestId: Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString()
    });
  }

  return requestOptions;
}

export async function makeGPS51Request(
  url: URL, 
  options: RequestInit
): Promise<{ response: Response; responseText: string; requestDuration: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    options.signal = controller.signal;
    const requestStartTime = Date.now();
    
    console.log('GPS51 Proxy: Starting fetch request:', {
      url: url.toString(),
      startTime: new Date(requestStartTime).toISOString(),
      timeout: '30s'
    });
    
    const response = await fetch(url.toString(), options);
    clearTimeout(timeoutId);
    
    const requestDuration = Date.now() - requestStartTime;
    console.log('GPS51 Proxy: Fetch completed:', {
      status: response.status,
      statusText: response.statusText,
      duration: `${requestDuration}ms`,
      url: url.toString()
    });
    
    const responseText = await response.text();
    
    return { response, responseText, requestDuration };
  } finally {
    clearTimeout(timeoutId);
  }
}