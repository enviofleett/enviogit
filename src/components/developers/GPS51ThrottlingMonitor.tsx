import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Clock, 
  Zap,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Shield
} from 'lucide-react';
import { gps51CentralizedRequestManager } from '@/services/gps51/GPS51CentralizedRequestManager';

export const GPS51ThrottlingMonitor = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = () => {
    setLoading(true);
    
    // Get current metrics from centralized manager
    const currentMetrics = gps51CentralizedRequestManager.getMetrics();
    const currentHealth = gps51CentralizedRequestManager.getHealthStatus();
    
    setMetrics(currentMetrics);
    setHealthStatus(currentHealth);
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const emergencyReset = () => {
    gps51CentralizedRequestManager.emergencyReset();
    fetchMetrics();
  };

  if (!metrics || !healthStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading GPS51 API monitoring...
        </CardContent>
      </Card>
    );
  }

  const successRate = metrics.totalRequests > 0 
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)
    : '0.0';

  const requestsPerMinute = metrics.requestsInLastMinute || 0;
  const maxRequestsPerMinute = metrics.rateLimitConfig.maxRequestsPerMinute;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>GPS51 API Throttling Protection</span>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of centralized GPS51 API request management and rate limiting protection
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  {getStatusIcon(healthStatus.status)}
                  <span className="font-semibold capitalize">{healthStatus.status}</span>
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(healthStatus.status)}`} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{healthStatus.message}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{successRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.successfulRequests} / {metrics.totalRequests} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queue Length</p>
                <p className="text-2xl font-bold">{metrics.queueLength}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Pending requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limiting Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Rate Limiting Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Requests per Minute</span>
              <span>{requestsPerMinute} / {maxRequestsPerMinute}</span>
            </div>
            <Progress 
              value={(requestsPerMinute / maxRequestsPerMinute) * 100} 
              className="h-2"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Min Interval</p>
              <p className="font-semibold">{metrics.rateLimitConfig.minRequestInterval}ms</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Max/Minute</p>
              <p className="font-semibold">{metrics.rateLimitConfig.maxRequestsPerMinute}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Max/Second</p>
              <p className="font-semibold">{metrics.rateLimitConfig.maxRequestsPerSecond}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Avg Response</p>
              <p className="font-semibold">{Math.round(metrics.averageResponseTime)}ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Circuit Breaker Protection</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {metrics.circuitBreakerOpen ? (
                <Badge variant="destructive" className="flex items-center space-x-1">
                  <XCircle className="w-3 h-3" />
                  <span>OPEN</span>
                </Badge>
              ) : (
                <Badge variant="default" className="flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>CLOSED</span>
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Circuit breaker {metrics.circuitBreakerOpen ? 'protecting' : 'monitoring'} API calls
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Threshold</p>
              <p className="font-semibold">{metrics.rateLimitConfig.circuitBreakerThreshold} failures</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Failed Requests</p>
              <p className="font-semibold text-red-600">{metrics.failedRequests}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Throttled</p>
              <p className="font-semibold text-yellow-600">{metrics.throttledRequests}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5" />
            <span>Emergency Controls</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Emergency Reset</p>
              <p className="text-sm text-muted-foreground">
                Clear all queued requests and reset metrics (use only in critical situations)
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={emergencyReset}
              className="flex items-center space-x-2"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Emergency Reset</span>
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Refresh Metrics</p>
              <p className="text-sm text-muted-foreground">
                Manually refresh monitoring data
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchMetrics}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protection Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Throttling Protection Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600">✅ Active Protections</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Centralized request management</li>
                <li>• Emergency rate limiting (2s minimum intervals)</li>
                <li>• Circuit breaker protection</li>
                <li>• Intelligent request queuing</li>
                <li>• Exponential backoff with jitter</li>
                <li>• Request deduplication</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-blue-600">📊 Performance Improvements</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 90+ second polling intervals (was 30s)</li>
                <li>• Single API request queue</li>
                <li>• Automatic throttling detection</li>
                <li>• Real-time health monitoring</li>
                <li>• Emergency recovery procedures</li>
                <li>• Comprehensive request metrics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};