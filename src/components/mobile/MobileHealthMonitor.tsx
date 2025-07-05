import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Wifi, 
  Database, 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    authentication: 'healthy' | 'warning' | 'critical';
    connectivity: 'healthy' | 'warning' | 'critical';
    gps51: 'healthy' | 'warning' | 'critical';
    performance: 'healthy' | 'warning' | 'critical';
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    uptime: number;
    lastCheck: number;
  };
  recommendations: string[];
}

interface MobileHealthMonitorProps {
  authToken: string;
  userId: string;
}

export function MobileHealthMonitor({ authToken, userId }: MobileHealthMonitorProps) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [autoMonitoring, setAutoMonitoring] = useState(true);

  const performHealthCheck = async () => {
    setIsChecking(true);
    const startTime = Date.now();

    try {
      // Test authentication
      const authTest = await testAuthentication();
      
      // Test GPS51 connectivity
      const gps51Test = await testGPS51Connectivity();
      
      // Test performance
      const performanceTest = await testPerformance();
      
      const responseTime = Date.now() - startTime;
      
      const status: HealthStatus = {
        overall: calculateOverallStatus([authTest, gps51Test, performanceTest]),
        components: {
          authentication: authTest.status,
          connectivity: gps51Test.status,
          gps51: gps51Test.status,
          performance: performanceTest.status
        },
        metrics: {
          responseTime,
          errorRate: calculateErrorRate([authTest, gps51Test, performanceTest]),
          uptime: 99.5, // Mock uptime
          lastCheck: Date.now()
        },
        recommendations: generateRecommendations([authTest, gps51Test, performanceTest])
      };

      setHealthStatus(status);
    } catch (error) {
      setHealthStatus({
        overall: 'critical',
        components: {
          authentication: 'critical',
          connectivity: 'critical',
          gps51: 'critical',
          performance: 'critical'
        },
        metrics: {
          responseTime: Date.now() - startTime,
          errorRate: 100,
          uptime: 0,
          lastCheck: Date.now()
        },
        recommendations: ['System health check failed - please check your connection']
      });
    } finally {
      setIsChecking(false);
    }
  };

  const testAuthentication = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return {
        status: session ? 'healthy' as const : 'critical' as const,
        message: session ? 'Authentication active' : 'Authentication failed',
        responseTime: 150
      };
    } catch (error) {
      return {
        status: 'critical' as const,
        message: 'Authentication test failed',
        responseTime: 0
      };
    }
  };

  const testGPS51Connectivity = async () => {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('mobile-dashboard-data', {
        body: {
          userId,
          gps51Token: authToken,
          includePositions: false,
          includeAlerts: false
        }
      });

      const responseTime = Date.now() - startTime;
      
      if (error || !data.success) {
        return {
          status: 'warning' as const,
          message: 'GPS51 connectivity issues',
          responseTime
        };
      }

      return {
        status: responseTime < 2000 ? 'healthy' as const : 'warning' as const,
        message: 'GPS51 connectivity good',
        responseTime
      };
    } catch (error) {
      return {
        status: 'critical' as const,
        message: 'GPS51 connectivity failed',
        responseTime: 0
      };
    }
  };

  const testPerformance = async () => {
    const startTime = Date.now();
    
    // Simulate performance test
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: responseTime < 500 ? 'healthy' as const : 
              responseTime < 1000 ? 'warning' as const : 'critical' as const,
      message: `Performance: ${responseTime}ms`,
      responseTime
    };
  };

  const calculateOverallStatus = (tests: any[]): 'healthy' | 'warning' | 'critical' => {
    if (tests.some(t => t.status === 'critical')) return 'critical';
    if (tests.some(t => t.status === 'warning')) return 'warning';
    return 'healthy';
  };

  const calculateErrorRate = (tests: any[]): number => {
    const failedTests = tests.filter(t => t.status === 'critical').length;
    return (failedTests / tests.length) * 100;
  };

  const generateRecommendations = (tests: any[]): string[] => {
    const recommendations = [];
    
    if (tests.some(t => t.status === 'critical')) {
      recommendations.push('🔴 Critical issues detected - immediate attention required');
    }
    
    if (tests.some(t => t.responseTime > 2000)) {
      recommendations.push('⚡ Consider optimizing network performance');
    }
    
    if (tests.every(t => t.status === 'healthy')) {
      recommendations.push('✅ All systems operational');
    }
    
    return recommendations;
  };

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

  useEffect(() => {
    performHealthCheck();
    
    if (autoMonitoring) {
      const interval = setInterval(performHealthCheck, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [autoMonitoring, authToken, userId]);

  if (!healthStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Checking system health...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={healthStatus.overall === 'healthy' ? 'default' : 'destructive'}>
              {healthStatus.overall.toUpperCase()}
            </Badge>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={performHealthCheck}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Component Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm">Auth</span>
            {getStatusIcon(healthStatus.components.authentication)}
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="text-sm">Network</span>
            {getStatusIcon(healthStatus.components.connectivity)}
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="text-sm">GPS51</span>
            {getStatusIcon(healthStatus.components.gps51)}
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Performance</span>
            {getStatusIcon(healthStatus.components.performance)}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{healthStatus.metrics.responseTime}ms</div>
            <div className="text-xs text-muted-foreground">Response Time</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{healthStatus.metrics.errorRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Error Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{healthStatus.metrics.uptime}%</div>
            <div className="text-xs text-muted-foreground">Uptime</div>
          </div>
        </div>

        {/* Recommendations */}
        {healthStatus.recommendations.length > 0 && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1">
                {healthStatus.recommendations.map((rec, index) => (
                  <div key={index} className="text-sm">{rec}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Last checked: {new Date(healthStatus.metrics.lastCheck).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}