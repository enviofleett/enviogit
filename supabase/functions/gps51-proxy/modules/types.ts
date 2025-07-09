export interface GPS51ProxyRequest {
  action: string;
  token?: string;
  params?: Record<string, any>;
  method?: 'GET' | 'POST';
  apiUrl?: string;
}

export interface GPS51Response {
  status: number;
  message?: string;
  records?: any[];
  data?: any;
  token?: string;
  user?: any;
  lastquerypositiontime?: number;
  proxy_metadata?: {
    processedAt: string;
    apiUrl: string;
    responseStatus: number;
    responseTime: number;
    requestDuration: number;
    totalDuration: number;
    proxyVersion: string;
    responseType?: string;
    contentType?: string;
    bodyLength?: number;
    action?: string;
    parseError?: string;
    suggestion?: string;
  };
}

export interface LogEntry {
  endpoint: string;
  method: string;
  request_payload: any;
  response_status: number;
  response_body: any;
  duration_ms: number;
  error_message?: string;
  timestamp: string;
}