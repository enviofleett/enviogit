import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  AlertCircle, 
  Clock, 
  Database, 
  Globe, 
  Shield,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';

interface GPS51HealthMetrics {
  requestsPerMinute: number;
  activePollers: number;
  rateLimitStatus: 'healthy' | 'warning' | 'critical';
  circuitBreakerOpen: boolean;
  cacheHitRate: number;
  averageResponseTime: number;
  recent8902Errors: number;
  lastSuccessfulRequest: string | null;
  coordinatorQueueSize: number;
}

interface RecentActivity {
  timestamp: string;
  endpoint: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

export const GPS51HealthDashboard = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<GPS51HealthMetrics>({
    requestsPerMinute: 0,
    activePollers: 0,
    rateLimitStatus: 'healthy',
    circuitBreakerOpen: false,
    cacheHitRate: 0,
    averageResponseTime: 0,
    recent8902Errors: 0,
    lastSuccessfulRequest: null,
    coordinatorQueueSize: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadHealthMetrics();
    loadRecentActivity();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadHealthMetrics();
      loadRecentActivity();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadHealthMetrics = async () => {
    try {
      // Get recent GPS51 API calls from the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentCalls } = await supabase
        .from('api_calls_monitor')
        .select('*')
        .or('endpoint.like.GPS51%,endpoint.eq.GPS51-Coordinator')
        .gte('timestamp', fiveMinutesAgo)
        .order('timestamp', { ascending: false });

      if (recentCalls) {
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const requestsLastMinute = recentCalls.filter(
          call => new Date(call.timestamp).getTime() > oneMinuteAgo
        );

        const successful = recentCalls.filter(call => call.response_status < 400);
        const failed = recentCalls.filter(call => call.response_status >= 400);
        const errors8902 = recentCalls.filter(call => 
          call.error_message?.includes('8902') || 
          (call.response_body && typeof call.response_body === 'object' && 
           'status' in call.response_body && call.response_body.status === 8902)
        );

        const responseTimes = recentCalls
          .filter(call => call.duration_ms > 0)
          .map(call => call.duration_ms);
        
        const avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0;

        // Determine rate limit status
        let rateLimitStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (errors8902.length > 0) {
          rateLimitStatus = 'critical';
        } else if (failed.length > successful.length * 0.2) {
          rateLimitStatus = 'warning';
        }

        setMetrics({
          requestsPerMinute: requestsLastMinute.length,
          activePollers: 0, // Would need to track this from polling services
          rateLimitStatus,
          circuitBreakerOpen: errors8902.length > 0,
          cacheHitRate: 0, // Would calculate from cache hits
          averageResponseTime: Math.round(avgResponseTime),
          recent8902Errors: errors8902.length,
          lastSuccessfulRequest: successful[0]?.timestamp || null,
          coordinatorQueueSize: 0 // Would get from coordinator
        });
      }
    } catch (error) {
      console.error('Failed to load health metrics:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data } = await supabase
        .from('api_calls_monitor')
        .select('timestamp, endpoint, response_status, duration_ms, error_message')
        .or('endpoint.like.GPS51%,endpoint.eq.GPS51-Coordinator')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (data) {
        const activity: RecentActivity[] = data.map(call => ({
          timestamp: call.timestamp,
          endpoint: call.endpoint,
          success: call.response_status < 400,
          responseTime: call.duration_ms || 0,
          error: call.error_message
        }));
        
        setRecentActivity(activity);
      }
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  };

  const triggerEmergencyStop = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('system_settings').upsert({
        key: 'gps51_emergency_stop',
        value: {
          active: true,
          reason: 'manual_dashboard_trigger',
          activatedAt: new Date().toISOString(),
          cooldownUntil: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: 'Emergency Stop Activated',
        description: 'All GPS51 API requests have been suspended',
        variant: 'destructive'
      });

      await loadHealthMetrics();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to activate emergency stop',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'default';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">GPS51 Health Dashboard</h2>
          <p className="text-muted-foreground">Real-time monitoring of GPS51 API interactions</p>
        </div>
        <Button 
          variant="destructive" 
          onClick={triggerEmergencyStop}
          disabled={isLoading}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Emergency Stop
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <div className="text-sm font-medium">Requests/Min</div>
            </div>
            <div className="text-2xl font-bold mt-1">{metrics.requestsPerMinute}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <div className="text-sm font-medium">Rate Limit</div>
            </div>
            <Badge variant={getStatusColor(metrics.rateLimitStatus)} className="mt-1">
              {metrics.rateLimitStatus.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div className="text-sm font-medium">Avg Response</div>
            </div>
            <div className="text-2xl font-bold mt-1">{metrics.averageResponseTime}ms</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div className="text-sm font-medium">8902 Errors</div>
            </div>
            <div className="text-2xl font-bold mt-1">{metrics.recent8902Errors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              <div className="text-sm font-medium">Circuit Breaker</div>
            </div>
            <Badge variant={metrics.circuitBreakerOpen ? "destructive" : "default"} className="mt-1">
              {metrics.circuitBreakerOpen ? "OPEN" : "CLOSED"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Last Successful Request</span>
              <span className="text-sm text-muted-foreground">
                {metrics.lastSuccessfulRequest 
                  ? formatTimestamp(metrics.lastSuccessfulRequest)
                  : 'No recent requests'
                }
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Coordinator Queue</span>
              <Badge variant={metrics.coordinatorQueueSize > 10 ? "destructive" : "default"}>
                {metrics.coordinatorQueueSize} requests
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Cache Hit Rate</span>
              <span className="text-sm font-medium">{metrics.cacheHitRate}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Last 20 GPS51 API interactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    {activity.success ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    )}
                    <span className="font-medium">{activity.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{activity.responseTime}ms</span>
                    <span className="text-muted-foreground">{formatTimestamp(activity.timestamp)}</span>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};