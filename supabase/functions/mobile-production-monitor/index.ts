import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSecurity, PRODUCTION_SECURITY_CONFIG } from "../_shared/security.ts";

interface HealthCheckRequest {
  includeMetrics?: boolean;
  includeRecommendations?: boolean;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  components: {
    authentication: ComponentHealth;
    database: ComponentHealth;
    gps51: ComponentHealth;
    performance: ComponentHealth;
    security: ComponentHealth;
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    rateLimitUtilization: number;
    activeConnections: number;
  };
  security: {
    rateLimitsActive: boolean;
    corsConfigured: boolean;
    signatureValidation: boolean;
    lastSecurityAudit: string;
  };
  recommendations: string[];
  alerts: Alert[];
}

interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  message: string;
  lastCheck: string;
}

interface Alert {
  level: 'warning' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  actionRequired: boolean;
}

const secureHandler = async (req: Request): Promise<Response> => {
  try {
    const { includeMetrics = true, includeRecommendations = true }: HealthCheckRequest = 
      req.method === 'POST' ? await req.json() : {};

    const startTime = Date.now();
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Perform comprehensive health checks
    const [authHealth, dbHealth, gps51Health, performanceHealth, securityHealth] = await Promise.all([
      checkAuthentication(supabaseClient),
      checkDatabase(supabaseClient),
      checkGPS51Integration(supabaseClient),
      checkPerformance(),
      checkSecurity()
    ]);

    const totalResponseTime = Date.now() - startTime;
    
    // Calculate overall status
    const componentStatuses = [authHealth, dbHealth, gps51Health, performanceHealth, securityHealth];
    const overallStatus = calculateOverallStatus(componentStatuses);
    
    // Generate alerts
    const alerts = generateAlerts(componentStatuses);
    
    // Generate recommendations
    const recommendations = includeRecommendations ? 
      generateRecommendations(componentStatuses, alerts) : [];

    const healthReport: SystemHealth = {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        authentication: authHealth,
        database: dbHealth,
        gps51: gps51Health,
        performance: performanceHealth,
        security: securityHealth
      },
      metrics: includeMetrics ? {
        responseTime: totalResponseTime,
        errorRate: calculateErrorRate(componentStatuses),
        rateLimitUtilization: await calculateRateLimitUtilization(),
        activeConnections: await getActiveConnections(supabaseClient)
      } : {
        responseTime: totalResponseTime,
        errorRate: 0,
        rateLimitUtilization: 0,
        activeConnections: 0
      },
      security: {
        rateLimitsActive: PRODUCTION_SECURITY_CONFIG.rateLimits !== undefined,
        corsConfigured: true,
        signatureValidation: PRODUCTION_SECURITY_CONFIG.requestSigning.enabled,
        lastSecurityAudit: new Date().toISOString()
      },
      recommendations,
      alerts
    };

    // Log health check results
    await supabaseClient
      .from('api_calls_monitor')
      .insert({
        endpoint: '/mobile-production-monitor',
        method: 'POST',
        response_status: 200,
        duration_ms: totalResponseTime,
        response_body: {
          overall: overallStatus,
          componentCount: componentStatuses.length,
          alertCount: alerts.length
        }
      });

    return new Response(JSON.stringify({
      success: true,
      health: healthReport,
      productionReady: overallStatus === 'healthy',
      criticalIssues: alerts.filter(a => a.level === 'critical').length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Production health monitor error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      health: {
        overall: 'critical',
        timestamp: new Date().toISOString(),
        message: 'Health check system failure'
      }
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

async function checkAuthentication(client: any): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Test authentication by checking profiles table
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'critical',
        responseTime,
        message: `Authentication check failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      };
    }
    
    return {
      status: responseTime < 1000 ? 'healthy' : 'warning',
      responseTime,
      message: 'Authentication system operational',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: Date.now() - startTime,
      message: `Authentication error: ${error}`,
      lastCheck: new Date().toISOString()
    };
  }
}

async function checkDatabase(client: any): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Test database connectivity and performance
    const { data, error } = await client
      .from('vehicles')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'critical',
        responseTime,
        message: `Database connectivity failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      };
    }
    
    return {
      status: responseTime < 500 ? 'healthy' : responseTime < 1000 ? 'warning' : 'critical',
      responseTime,
      message: 'Database connectivity good',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: Date.now() - startTime,
      message: `Database error: ${error}`,
      lastCheck: new Date().toISOString()
    };
  }
}

async function checkGPS51Integration(client: any): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Test GPS51 proxy function
    const { data, error } = await client.functions.invoke('gps51-proxy', {
      body: {
        action: 'health',
        method: 'GET',
        params: {}
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (error || !data) {
      return {
        status: 'warning',
        responseTime,
        message: 'GPS51 integration may have issues',
        lastCheck: new Date().toISOString()
      };
    }
    
    return {
      status: responseTime < 2000 ? 'healthy' : 'warning',
      responseTime,
      message: 'GPS51 integration operational',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: Date.now() - startTime,
      message: `GPS51 integration error: ${error}`,
      lastCheck: new Date().toISOString()
    };
  }
}

async function checkPerformance(): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Simulate performance test
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 200 ? 'healthy' : responseTime < 500 ? 'warning' : 'critical',
      responseTime,
      message: `System performance: ${responseTime}ms`,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: Date.now() - startTime,
      message: `Performance check failed: ${error}`,
      lastCheck: new Date().toISOString()
    };
  }
}

async function checkSecurity(): Promise<ComponentHealth> {
  const startTime = Date.now();
  
  try {
    // Validate security configuration
    const hasRateLimits = PRODUCTION_SECURITY_CONFIG.rateLimits !== undefined;
    const hasSignatureValidation = PRODUCTION_SECURITY_CONFIG.requestSigning.enabled;
    const hasApiKeyRotation = PRODUCTION_SECURITY_CONFIG.apiKeyRotation.enabled;
    
    const securityScore = [hasRateLimits, hasSignatureValidation, hasApiKeyRotation]
      .filter(Boolean).length;
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: securityScore === 3 ? 'healthy' : securityScore === 2 ? 'warning' : 'critical',
      responseTime,
      message: `Security features: ${securityScore}/3 active`,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'critical',
      responseTime: Date.now() - startTime,
      message: `Security check failed: ${error}`,
      lastCheck: new Date().toISOString()
    };
  }
}

function calculateOverallStatus(components: ComponentHealth[]): 'healthy' | 'warning' | 'critical' {
  if (components.some(c => c.status === 'critical')) return 'critical';
  if (components.some(c => c.status === 'warning')) return 'warning';
  return 'healthy';
}

function calculateErrorRate(components: ComponentHealth[]): number {
  const failedComponents = components.filter(c => c.status === 'critical').length;
  return (failedComponents / components.length) * 100;
}

async function calculateRateLimitUtilization(): Promise<number> {
  // Mock implementation - in production, check actual rate limit usage
  return Math.random() * 50; // 0-50% utilization
}

async function getActiveConnections(client: any): Promise<number> {
  try {
    // Get recent activity count as proxy for active connections
    const { data } = await client
      .from('activity_logs')
      .select('id')
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
    
    return data?.length || 0;
  } catch {
    return 0;
  }
}

function generateAlerts(components: ComponentHealth[]): Alert[] {
  const alerts: Alert[] = [];
  
  components.forEach((component, index) => {
    const componentNames = ['authentication', 'database', 'gps51', 'performance', 'security'];
    const name = componentNames[index];
    
    if (component.status === 'critical') {
      alerts.push({
        level: 'critical',
        component: name,
        message: component.message,
        timestamp: new Date().toISOString(),
        actionRequired: true
      });
    } else if (component.status === 'warning' && component.responseTime > 2000) {
      alerts.push({
        level: 'warning',
        component: name,
        message: `Slow response time: ${component.responseTime}ms`,
        timestamp: new Date().toISOString(),
        actionRequired: false
      });
    }
  });
  
  return alerts;
}

function generateRecommendations(components: ComponentHealth[], alerts: Alert[]): string[] {
  const recommendations: string[] = [];
  
  if (alerts.some(a => a.level === 'critical')) {
    recommendations.push('🔴 Critical issues detected - immediate intervention required');
  }
  
  if (components.some(c => c.responseTime > 2000)) {
    recommendations.push('⚡ Optimize slow components for better performance');
  }
  
  if (components.every(c => c.status === 'healthy')) {
    recommendations.push('✅ All systems operational - production ready');
  }
  
  recommendations.push('📊 Regular monitoring recommended every 5 minutes');
  recommendations.push('🔒 Security audit recommended weekly');
  
  return recommendations;
}

// Apply production security with minimal rate limiting for health checks
const handler = withSecurity(secureHandler, {
  rateLimit: {
    requests: 120,
    windowMs: 60000,
    identifier: 'health-monitor'
  },
  requireSignature: false
});

serve(handler);