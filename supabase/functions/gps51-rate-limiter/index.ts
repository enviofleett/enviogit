import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RateLimitState {
  lastRequestTime: number;
  consecutiveFailures: number;
  rateLimitCooldownUntil: number;
  circuitBreakerOpen: boolean;
  requestHistory: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
    action: string;
  }>;
}

let globalRateLimitState: RateLimitState = {
  lastRequestTime: 0,
  consecutiveFailures: 0,
  rateLimitCooldownUntil: 0,
  circuitBreakerOpen: false,
  requestHistory: []
};

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'check_limits' } = await req.json();

    switch (action) {
      case 'check_limits':
        return handleCheckLimits();
      case 'record_request':
        return handleRecordRequest(await req.json());
      case 'get_status':
        return handleGetStatus();
      case 'reset_state':
        return handleResetState();
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('GPS51 Rate Limiter error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCheckLimits(): Promise<Response> {
  const now = Date.now();
  
  // Check circuit breaker
  if (globalRateLimitState.circuitBreakerOpen) {
    // Try to recover after 5 minutes
    if (now - globalRateLimitState.rateLimitCooldownUntil > 300000) { // 5 minutes
      globalRateLimitState.circuitBreakerOpen = false;
      globalRateLimitState.consecutiveFailures = 0;
      console.log('GPS51 Rate Limiter: Circuit breaker recovered');
    } else {
      return new Response(
        JSON.stringify({
          shouldAllow: false,
          reason: 'circuit_breaker_open',
          waitTime: globalRateLimitState.rateLimitCooldownUntil - now,
          message: 'Circuit breaker is open due to consecutive failures'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Check rate limit cooldown
  if (now < globalRateLimitState.rateLimitCooldownUntil) {
    const waitTime = globalRateLimitState.rateLimitCooldownUntil - now;
    return new Response(
      JSON.stringify({
        shouldAllow: false,
        reason: 'rate_limit_cooldown',
        waitTime,
        message: `Rate limit cooldown active. Wait ${Math.ceil(waitTime / 1000)} seconds`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check minimum request spacing (3 seconds)
  const timeSinceLastRequest = now - globalRateLimitState.lastRequestTime;
  const minimumSpacing = 3000; // 3 seconds

  if (timeSinceLastRequest < minimumSpacing) {
    const waitTime = minimumSpacing - timeSinceLastRequest;
    return new Response(
      JSON.stringify({
        shouldAllow: false,
        reason: 'request_spacing',
        waitTime,
        message: `Minimum request spacing not met. Wait ${Math.ceil(waitTime / 1000)} seconds`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check recent failure pattern
  const last15Minutes = now - (15 * 60 * 1000);
  const recentRequests = globalRateLimitState.requestHistory.filter(r => r.timestamp > last15Minutes);
  const recentFailures = recentRequests.filter(r => !r.success).length;

  if (recentFailures > 10) {
    // High failure rate - activate cooldown
    globalRateLimitState.rateLimitCooldownUntil = now + (10 * 60 * 1000); // 10 minutes
    await logAlert('high_failure_rate', `${recentFailures} failures in last 15 minutes`);
    
    return new Response(
      JSON.stringify({
        shouldAllow: false,
        reason: 'high_failure_rate',
        waitTime: 10 * 60 * 1000,
        message: 'High failure rate detected. Activating 10-minute cooldown'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Allow request
  globalRateLimitState.lastRequestTime = now;
  
  return new Response(
    JSON.stringify({
      shouldAllow: true,
      reason: 'allowed',
      waitTime: 0,
      message: 'Request allowed',
      recommendedDelay: Math.max(3000 - timeSinceLastRequest, 0)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRecordRequest(data: any): Promise<Response> {
  const { action, success, responseTime, status } = data;
  const now = Date.now();

  // Record request in history
  globalRateLimitState.requestHistory.push({
    timestamp: now,
    success: !!success,
    responseTime: responseTime || 0,
    action: action || 'unknown'
  });

  // Keep only last 100 requests
  if (globalRateLimitState.requestHistory.length > 100) {
    globalRateLimitState.requestHistory = globalRateLimitState.requestHistory.slice(-100);
  }

  // Handle 8902 rate limit error specifically
  if (status === 8902 || (typeof status === 'string' && status.includes('8902'))) {
    console.warn('GPS51 Rate Limiter: 8902 error detected, activating immediate cooldown');
    globalRateLimitState.rateLimitCooldownUntil = now + (15 * 60 * 1000); // 15 minutes
    globalRateLimitState.consecutiveFailures++;
    
    await logAlert('8902_detected', 'GPS51 8902 rate limit error detected');
    
    // Open circuit breaker if too many 8902 errors
    if (globalRateLimitState.consecutiveFailures >= 3) {
      globalRateLimitState.circuitBreakerOpen = true;
      await logAlert('circuit_breaker_open', 'Circuit breaker opened due to consecutive 8902 errors');
    }
  } else if (success) {
    // Reset consecutive failures on success
    globalRateLimitState.consecutiveFailures = 0;
  } else {
    // Increment failures for other errors
    globalRateLimitState.consecutiveFailures++;
  }

  return new Response(
    JSON.stringify({
      status: 'recorded',
      consecutiveFailures: globalRateLimitState.consecutiveFailures,
      circuitBreakerOpen: globalRateLimitState.circuitBreakerOpen
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleGetStatus(): Promise<Response> {
  const now = Date.now();
  const last15Minutes = now - (15 * 60 * 1000);
  const recentRequests = globalRateLimitState.requestHistory.filter(r => r.timestamp > last15Minutes);
  
  const totalRequests = recentRequests.length;
  const successfulRequests = recentRequests.filter(r => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  return new Response(
    JSON.stringify({
      status: 'ok',
      rateLimitState: {
        lastRequestTime: globalRateLimitState.lastRequestTime,
        consecutiveFailures: globalRateLimitState.consecutiveFailures,
        rateLimitCooldownUntil: globalRateLimitState.rateLimitCooldownUntil,
        circuitBreakerOpen: globalRateLimitState.circuitBreakerOpen,
        isInCooldown: now < globalRateLimitState.rateLimitCooldownUntil,
        cooldownRemaining: Math.max(0, globalRateLimitState.rateLimitCooldownUntil - now)
      },
      metrics: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: Math.round(successRate),
        averageResponseTime: recentRequests.length > 0 
          ? Math.round(recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length)
          : 0
      },
      recommendations: {
        requestSpacing: 3000,
        shouldThrottle: failedRequests > 5,
        riskLevel: failedRequests > 10 ? 'high' : failedRequests > 5 ? 'medium' : 'low'
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleResetState(): Promise<Response> {
  globalRateLimitState = {
    lastRequestTime: 0,
    consecutiveFailures: 0,
    rateLimitCooldownUntil: 0,
    circuitBreakerOpen: false,
    requestHistory: []
  };

  await logAlert('state_reset', 'Rate limiter state manually reset');

  return new Response(
    JSON.stringify({ status: 'reset', message: 'Rate limiter state reset successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function logAlert(type: string, message: string): Promise<void> {
  try {
    await supabase.from('api_calls_monitor').insert({
      endpoint: 'GPS51-RateLimiter',
      method: 'ALERT',
      request_payload: { alertType: type, state: globalRateLimitState },
      response_status: 200,
      response_body: { message },
      duration_ms: 0,
      error_message: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Failed to log rate limiter alert:', error);
  }
}
