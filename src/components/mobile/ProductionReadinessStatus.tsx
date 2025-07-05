import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Database, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  Settings,
  TrendingUp
} from 'lucide-react';

interface ProductionHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    authentication: ComponentStatus;
    database: ComponentStatus;
    gps51: ComponentStatus;
    performance: ComponentStatus;
    security: ComponentStatus;
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
  alerts: {
    level: 'warning' | 'critical';
    component: string;
    message: string;
    timestamp: string;
    actionRequired: boolean;
  }[];
}

interface ComponentStatus {
  status: 'healthy' | 'warning' | 'critical';
  responseTime: number;
  message: string;
  lastCheck: string;
}

export function ProductionReadinessStatus() {
  const [health, setHealth] = useState<ProductionHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  const checkProductionHealth = async () => {
    setIsChecking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('mobile-production-monitor', {
        body: {
          includeMetrics: true,
          includeRecommendations: true
        }
      });

      if (error) throw error;

      if (data.success) {
        setHealth(data.health);
        
        // Show toast for critical issues
        const criticalAlerts = data.health.alerts.filter((a: any) => a.level === 'critical');
        if (criticalAlerts.length > 0) {
          toast({
            title: "Critical Issues Detected",
            description: `${criticalAlerts.length} critical issues require immediate attention`,
            variant: "destructive"
          });
        }
      } else {
        throw new Error(data.error || 'Health check failed');
      }
    } catch (error: any) {
      console.error('Production health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive"
      });
      
      // Set error state
      setHealth({
        overall: 'critical',
        components: {
          authentication: { status: 'critical', responseTime: 0, message: 'Health check failed', lastCheck: new Date().toISOString() },
          database: { status: 'critical', responseTime: 0, message: 'Health check failed', lastCheck: new Date().toISOString() },
          gps51: { status: 'critical', responseTime: 0, message: 'Health check failed', lastCheck: new Date().toISOString() },
          performance: { status: 'critical', responseTime: 0, message: 'Health check failed', lastCheck: new Date().toISOString() },
          security: { status: 'critical', responseTime: 0, message: 'Health check failed', lastCheck: new Date().toISOString() }
        },
        metrics: { responseTime: 0, errorRate: 100, rateLimitUtilization: 0, activeConnections: 0 },
        security: { rateLimitsActive: false, corsConfigured: false, signatureValidation: false, lastSecurityAudit: '' },
        recommendations: ['System health check failed - please check configuration'],
        alerts: [{
          level: 'critical',
          component: 'system',
          message: error.message,
          timestamp: new Date().toISOString(),
          actionRequired: true
        }]
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkProductionHealth();
    
    if (autoRefresh) {
      const interval = setInterval(checkProductionHealth, 5 * 60 * 1000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getProductionReadinessScore = (): number => {
    if (!health) return 0;
    
    const componentScores = Object.values(health.components).map(c => 
      c.status === 'healthy' ? 20 : c.status === 'warning' ? 10 : 0
    );
    
    return Math.max(0, componentScores.reduce((sum, score) => sum + score, 0));
  };

  if (!health) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Checking production readiness...</span>
        </CardContent>
      </Card>
    );
  }

  const readinessScore = getProductionReadinessScore();
  const isProductionReady = readinessScore >= 80;

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Production Readiness
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isProductionReady ? 'default' : 'destructive'}>
                {readinessScore}% Ready
              </Badge>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={checkProductionHealth}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Production Status Indicator */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className={`text-6xl font-bold ${getStatusColor(health.overall)}`}>
              {readinessScore}%
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {isProductionReady ? '✅ Production Ready' : '⚠️ Not Production Ready'}
            </div>
          </div>

          {/* Component Status Grid */}
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <Shield className="h-8 w-8 mx-auto mb-2" />
              <div className="text-xs font-medium">Auth</div>
              {getStatusIcon(health.components.authentication.status)}
              <div className="text-xs text-muted-foreground">
                {health.components.authentication.responseTime}ms
              </div>
            </div>
            
            <div className="text-center">
              <Database className="h-8 w-8 mx-auto mb-2" />
              <div className="text-xs font-medium">Database</div>
              {getStatusIcon(health.components.database.status)}
              <div className="text-xs text-muted-foreground">
                {health.components.database.responseTime}ms
              </div>
            </div>
            
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <div className="text-xs font-medium">GPS51</div>
              {getStatusIcon(health.components.gps51.status)}
              <div className="text-xs text-muted-foreground">
                {health.components.gps51.responseTime}ms
              </div>
            </div>
            
            <div className="text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2" />
              <div className="text-xs font-medium">Performance</div>
              {getStatusIcon(health.components.performance.status)}
              <div className="text-xs text-muted-foreground">
                {health.components.performance.responseTime}ms
              </div>
            </div>
            
            <div className="text-center">
              <Shield className="h-8 w-8 mx-auto mb-2" />
              <div className="text-xs font-medium">Security</div>
              {getStatusIcon(health.components.security.status)}
              <div className="text-xs text-muted-foreground">
                {health.components.security.responseTime}ms
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Rate Limiting:</span>
              {health.security.rateLimitsActive ? 
                <CheckCircle className="h-4 w-4 text-green-600" /> : 
                <AlertTriangle className="h-4 w-4 text-red-600" />
              }
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">CORS Config:</span>
              {health.security.corsConfigured ? 
                <CheckCircle className="h-4 w-4 text-green-600" /> : 
                <AlertTriangle className="h-4 w-4 text-red-600" />
              }
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Request Signing:</span>
              {health.security.signatureValidation ? 
                <CheckCircle className="h-4 w-4 text-green-600" /> : 
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              }
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Rate Limit Usage:</span>
              <span className="text-sm font-medium">
                {health.metrics.rateLimitUtilization.toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {health.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts ({health.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {health.alerts.map((alert, index) => (
              <Alert key={index} variant={alert.level === 'critical' ? 'destructive' : 'default'}>
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>{alert.component}:</strong> {alert.message}
                    </span>
                    {alert.actionRequired && (
                      <Badge variant="destructive">Action Required</Badge>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.recommendations.map((rec, index) => (
                <div key={index} className="text-sm flex items-center gap-2">
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}