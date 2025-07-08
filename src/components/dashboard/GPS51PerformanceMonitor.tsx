import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Activity, Zap, Database, Clock, Wifi, RefreshCw } from 'lucide-react';
import { gps51PerformanceOptimizer } from '@/services/gps51/GPS51PerformanceOptimizer';

export const GPS51PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState({
    cacheSize: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    connectionHealth: true,
    consecutiveFailures: 0,
    requestsPerMinute: 0,
    memoryUsage: 0
  });

  const [connectionHealth, setConnectionHealth] = useState({
    isHealthy: true,
    lastSuccessfulRequest: Date.now(),
    consecutiveFailures: 0,
    timeSinceLastSuccess: 0
  });

  useEffect(() => {
    const updateMetrics = () => {
      const performanceMetrics = gps51PerformanceOptimizer.getPerformanceMetrics();
      const healthMetrics = gps51PerformanceOptimizer.getConnectionHealth();
      
      setMetrics(performanceMetrics);
      setConnectionHealth(healthMetrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const formatMemoryUsage = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimeSince = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getHealthStatus = () => {
    if (!connectionHealth.isHealthy) return { color: 'destructive', text: 'Unhealthy' };
    if (connectionHealth.consecutiveFailures > 0) return { color: 'outline', text: 'Warning' };
    return { color: 'default', text: 'Healthy' };
  };

  const resetOptimizations = () => {
    gps51PerformanceOptimizer.reset();
    setMetrics({
      cacheSize: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      connectionHealth: true,
      consecutiveFailures: 0,
      requestsPerMinute: 0,
      memoryUsage: 0
    });
  };

  const healthStatus = getHealthStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          GPS51 Performance Monitor
          <Badge variant={healthStatus.color as any}>
            {healthStatus.text}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Health */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Health</span>
            </div>
            <div className="text-2xl font-bold">
              {connectionHealth.isHealthy ? '✅' : '❌'}
            </div>
            <div className="text-xs text-muted-foreground">
              Last success: {formatTimeSince(connectionHealth.timeSinceLastSuccess)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Response Time</span>
            </div>
            <div className="text-2xl font-bold">
              {metrics.averageResponseTime.toFixed(0)}ms
            </div>
            <div className="text-xs text-muted-foreground">
              {connectionHealth.consecutiveFailures} consecutive failures
            </div>
          </div>
        </div>

        {/* Cache Performance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="text-sm font-medium">Cache Performance</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold">{metrics.cacheSize}</div>
              <div className="text-xs text-muted-foreground">Entries</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{(metrics.cacheHitRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Hit Rate</div>
            </div>
            <div>
              <div className="text-lg font-semibold">{formatMemoryUsage(metrics.memoryUsage)}</div>
              <div className="text-xs text-muted-foreground">Memory</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Cache Efficiency</span>
              <span>{(metrics.cacheHitRate * 100).toFixed(1)}%</span>
            </div>
            <Progress value={metrics.cacheHitRate * 100} className="h-2" />
          </div>
        </div>

        {/* API Rate Limiting */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">API Rate Limiting</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold">{metrics.requestsPerMinute}</div>
              <div className="text-xs text-muted-foreground">Requests/min</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">30</div>
              <div className="text-xs text-muted-foreground">Rate Limit</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Rate Usage</span>
              <span>{((metrics.requestsPerMinute / 30) * 100).toFixed(1)}%</span>
            </div>
            <Progress 
              value={(metrics.requestsPerMinute / 30) * 100} 
              className="h-2"
            />
          </div>
        </div>

        {/* Performance Insights */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Performance Insights</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            {metrics.cacheHitRate > 0.8 && (
              <div className="text-green-600">✅ Excellent cache performance</div>
            )}
            {metrics.averageResponseTime < 1000 && (
              <div className="text-green-600">✅ Fast response times</div>
            )}
            {metrics.requestsPerMinute > 25 && (
              <div className="text-yellow-600">⚠️ Approaching rate limit</div>
            )}
            {!connectionHealth.isHealthy && (
              <div className="text-red-600">❌ Connection issues detected</div>
            )}
            {metrics.cacheSize === 0 && (
              <div className="text-blue-600">💡 Cache warming up...</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetOptimizations}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Reset Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};