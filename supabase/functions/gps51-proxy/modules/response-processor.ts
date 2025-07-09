import type { GPS51Response, GPS51ProxyRequest } from './types.ts';

export function processGPS51Response(
  response: Response,
  responseText: string,
  requestData: GPS51ProxyRequest,
  requestDuration: number,
  startTime: number
): GPS51Response {
  console.log('GPS51 Proxy: GPS51 API response:', {
    status: response.status,
    statusText: response.statusText,
    contentType: response.headers.get('Content-Type'),
    bodyLength: responseText.length,
    isJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('['),
    responsePreview: responseText.substring(0, 200)
  });

  let responseData: GPS51Response;
  const contentType = response.headers.get('Content-Type') || '';
  
  console.log('GPS51 Proxy: Processing response content:', {
    contentType,
    responseLength: responseText.length,
    isEmpty: responseText.trim().length === 0
  });

  // Handle binary/octet-stream responses
  if (contentType.includes('application/octet-stream') || contentType.includes('binary')) {
    console.warn('GPS51 Proxy: Received binary response - investigating parameter compatibility');
    
    if (responseText.length === 0) {
      responseData = {
        status: 0,
        message: 'Empty response received - possibly no data available for query',
        records: [],
        data: [],
        lastquerypositiontime: Date.now(),
        proxy_metadata: {
          responseType: 'empty_binary',
          action: requestData.action,
          suggestion: 'Parameters may be correct but no data available',
          processedAt: new Date().toISOString(),
          apiUrl: '',
          responseStatus: response.status,
          responseTime: Date.now(),
          requestDuration,
          totalDuration: Date.now() - startTime,
          proxyVersion: '2.0'
        }
      };
    } else {
      try {
        responseData = JSON.parse(responseText);
        console.log('GPS51 Proxy: Binary response parsed as JSON successfully');
      } catch {
        responseData = {
          status: 1,
          message: 'Binary response cannot be parsed as JSON - check API parameters',
          data: responseText.substring(0, 1000),
          proxy_metadata: {
            responseType: 'unparseable_binary',
            contentType,
            bodyLength: responseText.length,
            action: requestData.action,
            suggestion: 'Verify API endpoint and parameter format compatibility',
            processedAt: new Date().toISOString(),
            apiUrl: '',
            responseStatus: response.status,
            responseTime: Date.now(),
            requestDuration,
            totalDuration: Date.now() - startTime,
            proxyVersion: '2.0'
          }
        };
      }
    }
  } else {
    // Standard JSON response handling
    try {
      if (responseText.trim() === '') {
        responseData = {
          status: 0,
          message: 'Empty response from GPS51 API',
          records: [],
          data: [],
          lastquerypositiontime: Date.now()
        };
      } else {
        responseData = JSON.parse(responseText);
        
        // Normalize status field
        if (responseData.status !== undefined) {
          responseData.status = parseInt(responseData.status.toString()) || 0;
        }
        
        // Add lastquerypositiontime if missing for position queries
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
      
      responseData = {
        status: 1,
        message: 'Failed to parse GPS51 API response as JSON',
        data: responseText.substring(0, 500),
        proxy_metadata: {
          responseType: 'parse_error',
          contentType,
          bodyLength: responseText.length,
          action: requestData.action,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
          suggestion: 'Check GPS51 API response format or endpoint compatibility',
          processedAt: new Date().toISOString(),
          apiUrl: '',
          responseStatus: response.status,
          responseTime: Date.now(),
          requestDuration,
          totalDuration: Date.now() - startTime,
          proxyVersion: '2.0'
        }
      };
    }
  }

  // Add proxy metadata
  const totalDuration = Date.now() - startTime;
  responseData.proxy_metadata = {
    ...responseData.proxy_metadata,
    processedAt: new Date().toISOString(),
    apiUrl: '',
    responseStatus: response.status,
    responseTime: Date.now(),
    requestDuration,
    totalDuration,
    proxyVersion: '2.0'
  };

  return responseData;
}

export function createErrorResponse(
  error: Error,
  requestData: GPS51ProxyRequest,
  fetchDuration: number,
  targetUrl?: URL
): GPS51Response {
  let errorMessage = 'Request failed';
  let errorCode = 'UNKNOWN_ERROR';
  
  if (error.name === 'AbortError') {
    errorMessage = 'Request timeout - GPS51 API did not respond within 30 seconds';
    errorCode = 'REQUEST_TIMEOUT';
  } else if (error.message.includes('fetch')) {
    errorMessage = 'Network error - Unable to reach GPS51 API server';
    errorCode = 'NETWORK_ERROR';
  } else if (error.message.includes('DNS')) {
    errorMessage = 'DNS resolution failed for GPS51 API server';
    errorCode = 'DNS_ERROR';
  } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
    errorMessage = 'SSL/TLS connection error to GPS51 API server';
    errorCode = 'SSL_ERROR';
  }
  
  return {
    status: 502,
    message: errorMessage,
    proxy_metadata: {
      responseType: 'fetch_error',
      action: requestData.action,
      suggestion: 'Check network connectivity and GPS51 API status',
      processedAt: new Date().toISOString(),
      apiUrl: targetUrl?.toString() || '',
      responseStatus: 502,
      responseTime: Date.now(),
      requestDuration: fetchDuration,
      totalDuration: fetchDuration,
      proxyVersion: '2.0'
    }
  };
}