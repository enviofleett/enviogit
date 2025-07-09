import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';
import type { GPS51ProxyRequest } from './types.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function checkRateLimit(): Promise<{ shouldAllow: boolean; message?: string; waitTime?: number }> {
  try {
    const rateLimitCheck = await supabase.functions.invoke('gps51-rate-limiter', {
      body: { action: 'check_limits' }
    });

    if (rateLimitCheck.data && !rateLimitCheck.data.shouldAllow) {
      console.warn('GPS51 Proxy: Request blocked by rate limiter:', rateLimitCheck.data);
      return {
        shouldAllow: false,
        message: rateLimitCheck.data.message,
        waitTime: rateLimitCheck.data.waitTime
      };
    }

    return { shouldAllow: true };
  } catch (rateLimitError) {
    console.warn('GPS51 Proxy: Rate limiter check failed, proceeding without rate limiting:', rateLimitError);
    return { shouldAllow: true };
  }
}

export async function recordRequest(
  requestData: GPS51ProxyRequest,
  success: boolean,
  responseTime: number,
  status: number
): Promise<void> {
  try {
    await supabase.functions.invoke('gps51-rate-limiter', {
      body: {
        action: 'record_request',
        action_type: requestData.action,
        success,
        responseTime,
        status
      }
    });
  } catch (rateLimitError) {
    console.warn('GPS51 Proxy: Failed to update rate limiter:', rateLimitError);
  }
}

export async function handleRateLimitError(
  requestData: GPS51ProxyRequest,
  requestDuration: number
): Promise<void> {
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