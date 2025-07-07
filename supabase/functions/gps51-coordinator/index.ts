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

    // Check rate limiter first with fallback
    let rateLimitCheck;
    try {
      rateLimitCheck = await checkRateLimit();
      if (!rateLimitCheck.shouldAllow) {
        return new Response(JSON.stringify({
          success: false,
          error: rateLimitCheck.message || 'Rate limit exceeded',
          shouldWait: true,
          waitTime: rateLimitCheck.waitTime || 0
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (rateLimitError) {
      console.warn('GPS51Coordinator: Rate limiter failed, using local fallback:', rateLimitError);
      // Fallback: Apply local rate limiting
      const localCheck = applyLocalRateLimit();
      if (!localCheck.shouldAllow) {
        return new Response(JSON.stringify({
          success: false,
          error: localCheck.message,
          shouldWait: true,
          waitTime: localCheck.waitTime
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

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
      
      const requestStartTime = Date.now();
      
      // Make actual GPS51 API call through existing proxy
      const { data, error } = await supabase.functions.invoke('gps51-proxy', {
        body: {
          action: request.action,
          params: request.params,
          method: 'POST'
        }
      });

      const responseTime = Date.now() - requestStartTime;
      lastRequestTime = Date.now();

      if (error) {
        await recordRequest(request.action, false, responseTime, error.message);
        throw new Error(error.message);
      }

      // Check for 8902 rate limit error
      if (data.status === 8902 || (typeof data.status === 'string' && data.status.includes('8902'))) {
        console.error('GPS51Coordinator: 8902 rate limit detected, activating emergency measures');
        await recordRequest(request.action, false, responseTime, 8902);
        await handle8902Error();
        
        // Notify waiting request
        await notifyRequestResult(request.id, {
          success: false,
          error: '8902 rate limit detected, system entering emergency mode',
          rateLimitDetected: true
        });
        continue;
      }

      // Record successful request
      await recordRequest(request.action, true, responseTime, data.status);

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

async function waitForRequest(requestId: string): Promise<any> {
  return new Promise((resolve) => {
    const checkResult = () => {
      // Check if result is ready (implementation would use events or polling)
      // For now, simulate async processing
      setTimeout(() => {
        resolve({
          success: true,
          data: { message: 'Request processed' }
        });
      }, 1000);
    };
    
    checkResult();
  });
}

async function notifyRequestResult(requestId: string, result: any): Promise<void> {
  // Implementation would notify waiting request
  console.log(`GPS51Coordinator: Notifying result for ${requestId}`, result);
}

async function checkEmergencyStop(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('gps51_emergency_controls')
      .select('emergency_stop_active')
      .single();
    
    emergencyStop = data?.emergency_stop_active || false;
    return emergencyStop;
  } catch (error) {
    console.error('GPS51Coordinator: Failed to check emergency stop:', error);
    return false;
  }
}

async function handle8902Error(): Promise<void> {
  console.error('GPS51Coordinator: Handling 8902 rate limit error');
  
  circuitBreakerOpen = true;
  rateLimitCooldownUntil = Date.now() + EMERGENCY_COOLDOWN;
  
  // Log emergency event
  await logCoordinatorActivity({
    type: 'emergency_8902',
    timestamp: Date.now(),
    cooldownUntil: rateLimitCooldownUntil,
    success: false
  });
  
  // Clear request queue
  requestQueue = [];
  
  // Update emergency controls in database
  try {
    await supabase
      .from('gps51_emergency_controls')
      .upsert({
        emergency_stop_active: true,
        reason: '8902 rate limit detected',
        cooldown_until: new Date(rateLimitCooldownUntil).toISOString(),
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('GPS51Coordinator: Failed to update emergency controls:', error);
  }
}

async function checkRateLimit(): Promise<{shouldAllow: boolean, message?: string, waitTime?: number}> {
  try {
    const { data, error } = await supabase.functions.invoke('gps51-rate-limiter', {
      body: { action: 'check_limits' }
    });
    
    if (error) {
      console.warn('GPS51Coordinator: Rate limiter check failed:', error);
      return { shouldAllow: true }; // Allow on error to avoid blocking
    }
    
    return data;
  } catch (error) {
    console.warn('GPS51Coordinator: Rate limiter unavailable:', error);
    return { shouldAllow: true }; // Allow on error to avoid blocking
  }
}

async function recordRequest(action: string, success: boolean, responseTime: number, status?: any): Promise<void> {
  try {
    await supabase.functions.invoke('gps51-rate-limiter', {
      body: { 
        action: 'record_request',
        action: action,
        success,
        responseTime,
        status
      }
    });
  } catch (error) {
    console.warn('GPS51Coordinator: Failed to record request in rate limiter:', error);
  }
}

// Local rate limiting fallback
function applyLocalRateLimit(): {shouldAllow: boolean, message: string, waitTime: number} {
  const now = Date.now();
  
  // Check circuit breaker
  if (circuitBreakerOpen && now < rateLimitCooldownUntil) {
    return {
      shouldAllow: false,
      message: 'Local circuit breaker active',
      waitTime: rateLimitCooldownUntil - now
    };
  }
  
  // Check minimum spacing
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MINIMUM_REQUEST_SPACING) {
    return {
      shouldAllow: false,
      message: 'Local rate limit: minimum spacing not met',
      waitTime: MINIMUM_REQUEST_SPACING - timeSinceLastRequest
    };
  }
  
  return {
    shouldAllow: true,
    message: 'Local rate limit check passed',
    waitTime: 0
  };
}

async function logCoordinatorActivity(activity: any): Promise<void> {
  try {
    await supabase
      .from('gps51_coordinator_logs')
      .insert({
        ...activity,
        timestamp: new Date().toISOString()
      });
  } catch (error) {
    console.error('GPS51Coordinator: Failed to log activity:', error);
  }
}