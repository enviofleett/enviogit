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

interface HealthCheck {
  timestamp: number;
  success: boolean;
  responseTime: number;
  statusCode: number;
  error?: string;
}

let healthHistory: HealthCheck[] = [];

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'health_check' } = await req.json();

    switch (action) {
      case 'health_check':
        return await performHealthCheck();
      case 'get_status':
        return getHealthStatus();
      case 'get_recommendations':
        return getHealthRecommendations();
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('GPS51 Health Monitor error:', error);
    return new Response(
      JSON.stringify( 
        { 
          error: 'Internal server error',
          message: error.message 
        }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function performHealthCheck(): Promise<Response> {
  const checkStartTime = Date.now();
  
  try {
    console.log('GPS51 Health Monitor: Starting health check');

    // Check rate limiter status first
    const rateLimiterCheck = await checkRateLimiterStatus();
    
    if (!rateLimiterCheck.shouldProceed) {
      return new Response(
        JSON.stringify({
          status: 'rate_limited',
          message: 'Health check skipped due to rate limiting',
          rateLimiter: rateLimiterCheck,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform actual GPS51 API health check
    const gps51Health = await checkGPS51APIHealth();
    
    // Record health check result
    const healthCheck: HealthCheck = {
      timestamp: Date.now(),
      success: gps51Health.success,
      responseTime: gps51Health.responseTime,
      statusCode: gps51Health.statusCode,
      error: gps51Health.error
    };

    healthHistory.push(healthCheck);
    
    // Keep only last 100 health checks
    if (healthHistory.length > 100) {
      healthHistory = healthHistory.slice(-100);
    }

    // Update rate limiter with result
    await updateRateLimiter(healthCheck);

    // Check if alert is needed
    await checkForAlerts(healthCheck);

    // Log health check to database
    await logHealthCheck(healthCheck);

    const totalTime = Date.now() - checkStartTime;

    return new Response(
      JSON.stringify({
        status: gps51Health.success ? 'healthy' : 'unhealthy',
        gps51: gps51Health,
        rateLimiter: rateLimiterCheck,
        totalCheckTime: totalTime,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Health check failed:', error);
    
    const failedCheck: HealthCheck = {
      timestamp: Date.now(),
      success: false,
      responseTime: Date.now() - checkStartTime,
      statusCode: 0,
      error: error.message
    };

    healthHistory.push(failedCheck);
    await updateRateLimiter(failedCheck);

    return new Response(
      JSON.stringify({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function checkRateLimiterStatus() {
  try {
    const response = await supabase.functions.invoke('gps51-rate-limiter', {
      body: { action: 'check_limits' }
    });

    if (response.error) {
      console.warn('Rate limiter check failed:', response.error);
      return { shouldProceed: true, error: response.error };
    }

    const result = response.data;
    return {
      shouldProceed: result.shouldAllow,
      reason: result.reason,
      waitTime: result.waitTime,
      message: result.message
    };
  } catch (error) {
    console.warn('Rate limiter unavailable:', error);
    return { shouldProceed: true, error: 'Rate limiter unavailable' };
  }
}

async function checkGPS51APIHealth() {
  const startTime = Date.now();
  
  try {
    // Use the GPS51 proxy to test connectivity
    const response = await supabase.functions.invoke('gps51-proxy', {
      body: {
        action: 'login',
        params: {
          username: 'health-check-user',
          password: 'health-check-pass',
          from: 'WEB',
          type: 'USER'
        },
        method: 'POST',
        apiUrl: 'https://api.gps51.com/openapi'
      }
    });

    const responseTime = Date.now() - startTime;

    if (response.error) {
      return {
        success: false,
        responseTime,
        statusCode: 0,
        error: `Proxy error: ${response.error.message}`,
        details: response.error
      };
    }

    const data = response.data;
    
    // Check for GPS51 specific errors
    if (data.status === 8902) {
      return {
        success: false,
        responseTime,
        statusCode: 8902,
        error: 'GPS51 Rate limit detected (8902)',
        isRateLimit: true
      };
    }

    // Even authentication failure is considered "healthy" for connectivity
    const isConnected = !data.proxy_error;
    
    return {
      success: isConnected,
      responseTime,
      statusCode: data.status || 0,
      error: data.proxy_error ? data.error : null,
      gps51Status: data.status,
      message: data.message,
      isConnected,
      performanceRating: responseTime < 1000 ? 'excellent' : responseTime < 3000 ? 'good' : 'slow'
    };

  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      statusCode: 0,
      error: `Connection error: ${error.message}`
    };
  }
}

async function updateRateLimiter(healthCheck: HealthCheck) {
  try {
    await supabase.functions.invoke('gps51-rate-limiter', {
      body: {
        action: 'record_request',
        action_type: 'health_check',
        success: healthCheck.success,
        responseTime: healthCheck.responseTime,
        status: healthCheck.statusCode
      }
    });
  } catch (error) {
    console.warn('Failed to update rate limiter:', error);
  }
}

async function checkForAlerts(healthCheck: HealthCheck) {
  // Check for consecutive failures
  const last5Checks = healthHistory.slice(-5);
  const consecutiveFailures = last5Checks.filter(check => !check.success).length;

  if (consecutiveFailures >= 3) {
    await createAlert('environment_down', 'high', 
      'GPS51 API Health Critical', 
      `${consecutiveFailures} consecutive health check failures detected`);
  }

  // Check for 8902 rate limit errors
  if (healthCheck.statusCode === 8902) {
    await createAlert('performance_degradation', 'high',
      'GPS51 Rate Limit (8902) Detected',
      'GPS51 API returned status 8902 indicating rate limiting');
  }

  // Check for slow response times
  if (healthCheck.success && healthCheck.responseTime > 10000) {
    await createAlert('performance_degradation', 'medium',
      'GPS51 API Slow Response',
      `Health check took ${healthCheck.responseTime}ms to complete`);
  }
}

async function createAlert(alertType: string, severity: string, title: string, description: string) {
  try {
    await supabase.from('synthetic_monitoring_alerts').insert({
      alert_type: alertType,
      severity,
      title,
      description,
      environment: 'production',
      metadata: {
        source: 'gps51-health-monitor',
        healthHistory: healthHistory.slice(-10) // Include recent history
      }
    });
  } catch (error) {
    console.error('Failed to create alert:', error);
  }
}

async function logHealthCheck(healthCheck: HealthCheck) {
  try {
    await supabase.from('api_calls_monitor').insert({
      endpoint: 'GPS51-HealthMonitor',
      method: 'HEALTH_CHECK',
      request_payload: { action: 'health_check' },
      response_status: healthCheck.success ? 200 : 500,
      response_body: {
        success: healthCheck.success,
        statusCode: healthCheck.statusCode,
        error: healthCheck.error
      },
      duration_ms: healthCheck.responseTime,
      error_message: healthCheck.error,
      timestamp: new Date(healthCheck.timestamp).toISOString()
    });
  } catch (error) {
    console.warn('Failed to log health check:', error);
  }
}

function getHealthStatus(): Response {
  const now = Date.now();
  const last15Minutes = now - (15 * 60 * 1000);
  const recentChecks = healthHistory.filter(check => check.timestamp > last15Minutes);
  
  const totalChecks = recentChecks.length;
  const successfulChecks = recentChecks.filter(check => check.success).length;
  const failedChecks = totalChecks - successfulChecks;
  const successRate = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
  
  const averageResponseTime = recentChecks.length > 0
    ? recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length
    : 0;

  const lastCheck = healthHistory[healthHistory.length - 1];
  const overallStatus = successRate >= 90 ? 'healthy' : successRate >= 70 ? 'degraded' : 'critical';

  return new Response(
    JSON.stringify({
      status: overallStatus,
      metrics: {
        totalChecks,
        successfulChecks,
        failedChecks,
        successRate: Math.round(successRate),
        averageResponseTime: Math.round(averageResponseTime)
      },
      lastCheck: lastCheck ? {
        timestamp: new Date(lastCheck.timestamp).toISOString(),
        success: lastCheck.success,
        responseTime: lastCheck.responseTime,
        error: lastCheck.error
      } : null,
      recommendations: getHealthRecommendationsData(successRate, averageResponseTime, recentChecks)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getHealthRecommendations(): Response {
  const recommendations = getHealthRecommendationsData();
  
  return new Response(
    JSON.stringify({ recommendations }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function getHealthRecommendationsData(successRate?: number, avgResponseTime?: number, recentChecks?: HealthCheck[]) {
  const recommendations = [];

  if (successRate !== undefined && successRate < 90) {
    recommendations.push({
      type: 'critical',
      title: 'Improve API Reliability',
      description: `Success rate is ${Math.round(successRate)}%. Investigate connection issues.`
    });
  }

  if (avgResponseTime !== undefined && avgResponseTime > 5000) {
    recommendations.push({
      type: 'performance',
      title: 'Optimize Response Times',
      description: `Average response time is ${Math.round(avgResponseTime)}ms. Consider request optimization.`
    });
  }

  if (recentChecks) {
    const rateLimitErrors = recentChecks.filter(check => check.statusCode === 8902).length;
    if (rateLimitErrors > 0) {
      recommendations.push({
        type: 'rate_limiting',
        title: 'Address Rate Limiting',
        description: `${rateLimitErrors} rate limit errors detected. Implement better request spacing.`
      });
    }
  }

  return recommendations;
}
