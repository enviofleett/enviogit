import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import type { LogEntry } from './types.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function logApiCall(
  endpoint: string,
  method: string,
  requestPayload: any,
  responseStatus: number,
  responseBody: any,
  durationMs: number,
  errorMessage?: string,
  clientIP?: string,
  userAgent?: string
): Promise<void> {
  try {
    const logEntry: LogEntry = {
      endpoint: `GPS51-EdgeFunction-${endpoint}`,
      method,
      request_payload: {
        ...requestPayload,
        clientIP,
        userAgent,
        timestamp: new Date().toISOString()
      },
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    };

    await supabase.from('api_calls_monitor').insert(logEntry);
  } catch (logError) {
    console.warn('Failed to log API call to database:', logError);
  }
}