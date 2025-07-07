import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface GPS51Request {
  id: string;
  action: string;
  params: any;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  requesterId: string;
}

interface CachedResponse {
  data: any;
  timestamp: number;
  expiresAt: number;
}

// Global state for the coordinator
let requestQueue: GPS51Request[] = [];
let processing = false;
let lastRequestTime = 0;
let emergencyStop = false;
let circuitBreakerOpen = false;
let responseCache = new Map<string, CachedResponse>();
let rateLimitCooldownUntil = 0;

const MINIMUM_REQUEST_SPACING = 5000; // 5 seconds between ANY GPS51 requests
const CACHE_DURATION = 60000; // 1 minute cache
const EMERGENCY_COOLDOWN = 30 * 60 * 1000; // 30 minutes for 8902 errors

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, params, priority = 'normal', requesterId } = await req.json();

    // Check for emergency stop
    if (await checkEmergencyStop()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'GPS51 requests suspended due to emergency stop',
        emergencyStop: true
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check circuit breaker
    if (circuitBreakerOpen && Date.now() < rateLimitCooldownUntil) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Circuit breaker open due to rate limits',
        cooldownRemaining: rateLimitCooldownUntil - Date.now()
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check cache for duplicate requests
    const cacheKey = `${action}:${JSON.stringify(params)}`;
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`GPS51Coordinator: Serving cached response for ${cacheKey}`);
      return new Response(JSON.stringify({
        success: true,
        data: cached.data,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add request to queue
    const request: GPS51Request = {
      id: crypto.randomUUID(),
      action,
      params,
      timestamp: Date.now(),
      priority,
      requesterId
    };

    requestQueue.push(request);
    requestQueue.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return a.timestamp - b.timestamp;
    });

    // Start processing if not already running
    if (!processing) {
      processQueue();
    }

    // Wait for this specific request to be processed
    const result = await waitForRequest(request.id);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('GPS51Coordinator error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processQueue() {
  if (processing || requestQueue.length === 0) return;
  
  processing = true;
  
  while (requestQueue.length > 0 && !emergencyStop && !circuitBreakerOpen) {
    // Ensure minimum spacing between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < MINIMUM_REQUEST_SPACING) {
      await new Promise(resolve => setTimeout(resolve, MINIMUM_REQUEST_SPACING - timeSinceLastRequest));
    }

    const request = requestQueue.shift();
    if (!request) continue;

    try {
      console.log(`GPS51Coordinator: Processing request ${request.id} - ${request.action}`);
      
      // Make actual GPS51 API call through existing proxy
      const { data, error } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: request.action,
          params: request.params,
          method: 'POST'
        }
      });

      lastRequestTime = Date.now();

      if (error) {
        throw new Error(error.message);
      }

      // Check for 8902 rate limit error
      if (data.status === 8902 || (typeof data.status === 'string' && data.status.includes('8902'))) {
        console.error('GPS51Coordinator: 8902 rate limit detected, activating emergency measures');
        await handle8902Error();
        
        // Notify waiting request
        await notifyRequestResult(request.id, {
          success: false,
          error: '8902 rate limit detected, system entering emergency mode',
          rateLimitDetected: true
        });
        continue;
      }

      // Cache successful response
      const cacheKey = `${request.action}:${JSON.stringify(request.params)}`;
      responseCache.set(cacheKey, {
        data: data,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION
      });

      // Clean old cache entries
      for (const [key, cached] of responseCache.entries()) {
        if (cached.expiresAt < Date.now()) {
          responseCache.delete(key);
        }
      }

      // Notify waiting request
      await notifyRequestResult(request.id, {
        success: true,
        data: data
      });

      // Log successful request
      await logCoordinatorActivity({
        type: 'request_processed',
        requestId: request.id,
        action: request.action,
        success: true,
        processingTime: Date.now() - request.timestamp
      });

    } catch (error) {
      console.error(`GPS51Coordinator: Request ${request.id} failed:`, error);
      
      await notifyRequestResult(request.id, {
        success: false,
        error: error.message
      });

      await logCoordinatorActivity({
        type: 'request_failed',
        requestId: request.id,
        action: request.action,
        success: false,
        error: error.message
      });
    }
  }
  
  processing = false;
}

async function handle8902Error() {
  circuitBreakerOpen = true;
  rateLimitCooldownUntil = Date.now() + EMERGENCY_COOLDOWN;
  
  // Clear queue to prevent further requests
  requestQueue = [];
  
  // Log the emergency event
  await logCoordinatorActivity({
    type: '8902_emergency_activated',
    cooldownUntil: rateLimitCooldownUntil,
    success: false
  });
  
  // Try to activate system-wide emergency stop
  try {
    await supabase.from('system_settings').upsert({
      key: 'gps51_emergency_stop',
      value: JSON.stringify({
        active: true,
        reason: '8902_rate_limit_detected',
        activatedAt: new Date().toISOString(),
        cooldownUntil: new Date(rateLimitCooldownUntil).toISOString()
      })
    });
  } catch (error) {
    console.error('Failed to activate emergency stop:', error);
  }
}

async function checkEmergencyStop(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'gps51_emergency_stop')
      .single();
    
    if (data?.value) {
      const emergencyData = JSON.parse(data.value);
      emergencyStop = emergencyData.active && new Date(emergencyData.cooldownUntil) > new Date();
      return emergencyStop;
    }
  } catch (error) {
    console.warn('Could not check emergency stop status:', error);
  }
  
  return false;
}

async function waitForRequest(requestId: string): Promise<any> {
  return new Promise((resolve) => {
    const checkResult = () => {
      // Check if request was processed (removed from queue and result stored)
      const stillInQueue = requestQueue.find(r => r.id === requestId);
      if (!stillInQueue) {
        // Request was processed, check for stored result
        // For now, we'll use a simple timeout approach
        setTimeout(() => {
          resolve({
            success: false,
            error: 'Request timeout or processing error'
          });
        }, 30000); // 30 second timeout
      } else {
        setTimeout(checkResult, 100); // Check every 100ms
      }
    };
    checkResult();
  });
}

async function notifyRequestResult(requestId: string, result: any) {
  // In a real implementation, this would use a more sophisticated 
  // pub/sub mechanism. For now, we'll rely on the queue processing logic.
  console.log(`GPS51Coordinator: Request ${requestId} completed:`, result);
}

async function logCoordinatorActivity(activity: any) {
  try {
    await supabase.from('api_calls_monitor').insert({
      endpoint: 'GPS51-Coordinator',
      method: 'COORDINATE',
      request_payload: activity,
      response_status: activity.success ? 200 : 500,
      response_body: activity,
      duration_ms: activity.processingTime || 0,
      error_message: activity.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Failed to log coordinator activity:', error);
  }
}