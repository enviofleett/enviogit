import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { gps51UnifiedPollingCoordinator } from '@/services/gps51/GPS51UnifiedPollingCoordinator';
import { GPS51CentralizedRequestManager } from '@/services/gps51/GPS51CentralizedRequestManager';
import { AlertTriangle, Activity, Zap, RefreshCw, StopCircle, CheckCircle } from 'lucide-react';

export function GPS51EmergencyControlPanel() {
  const [status, setStatus] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update status every 5 seconds
  useEffect(() => {
    const updateStatus = () => {
      const coordinatorStatus = gps51UnifiedPollingCoordinator.getStatus();
      const requestManager = GPS51CentralizedRequestManager.getInstance();
      const requestMetrics = requestManager.getMetrics();
      const healthStatus = requestManager.getHealthStatus();

      setStatus({
        coordinator: coordinatorStatus,
        health: healthStatus
      });
      setMetrics(requestMetrics);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleEmergencyReset = async () => {
    try {
      setIsRefreshing(true);
      gps51UnifiedPollingCoordinator.emergencyReset();
      
      // Wait a moment for reset to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update status
      const coordinatorStatus = gps51UnifiedPollingCoordinator.getStatus();
      const requestManager = GPS51CentralizedRequestManager.getInstance();
      const healthStatus = requestManager.getHealthStatus();
      
      setStatus({
        coordinator: coordinatorStatus,
        health: healthStatus
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await gps51UnifiedPollingCoordinator.refresh('combined');
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!status || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            GPS51 Emergency Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-success text-success-foreground';
      case 'degraded': return 'bg-warning text-warning-foreground';
      case 'critical': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <Zap className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const successRate = metrics.totalRequests > 0 
    ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Emergency Alert */}
      {(status.coordinator.emergencyStop || status.health.status === 'critical') && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Emergency Mode Active:</strong> {status.health.message}
            {status.coordinator.emergencyStop && " Automatic recovery in progress."}
          </AlertDescription>
        </Alert>
      )}

      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            GPS51 System Status
          </CardTitle>
          <CardDescription>
            Real-time monitoring of GPS51 API integration health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Health */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall Health</span>
            <Badge className={getStatusColor(status.health.status)}>
              {getStatusIcon(status.health.status)}
              <span className="ml-1 capitalize">{status.health.status}</span>
            </Badge>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">API Success Rate</span>
              <span className="text-sm text-muted-foreground">{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>

          {/* Active Subscriptions */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Active Subscriptions</span>
            <Badge variant="outline">{status.coordinator.subscriptions}</Badge>
          </div>

          {/* Polling Status */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Polling Status</span>
            <Badge variant={status.coordinator.isPolling ? "default" : "secondary"}>
              {status.coordinator.isPolling ? "Active" : "Stopped"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>API Metrics</CardTitle>
          <CardDescription>
            Request statistics and rate limiting information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-sm font-medium">Total Requests</span>
              <div className="text-2xl font-bold">{metrics.totalRequests}</div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Queue Length</span>
              <div className="text-2xl font-bold">{metrics.queueLength}</div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Throttled Requests</span>
              <div className="text-2xl font-bold text-destructive">{metrics.throttledRequests}</div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Avg Response Time</span>
              <div className="text-2xl font-bold">{metrics.averageResponseTime}ms</div>
            </div>
          </div>

          <Separator />

          {/* Rate Limiting Info */}
          <div className="space-y-2">
            <h4 className="font-medium">Rate Limiting (Emergency Mode)</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Max per minute:</span>
                <span className="ml-2 font-mono">{metrics.rateLimitConfig.maxRequestsPerMinute}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Min interval:</span>
                <span className="ml-2 font-mono">{metrics.rateLimitConfig.minRequestInterval}ms</span>
              </div>
              <div>
                <span className="text-muted-foreground">Requests this minute:</span>
                <span className="ml-2 font-mono">{metrics.requestsInLastMinute}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Circuit breaker:</span>
                <Badge variant={metrics.circuitBreakerOpen ? "destructive" : "outline"} className="ml-2">
                  {metrics.circuitBreakerOpen ? "OPEN" : "Closed"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Status */}
      <Card>
        <CardHeader>
          <CardTitle>Data Cache Status</CardTitle>
          <CardDescription>
            Current cached data and freshness information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-sm font-medium">Cached Vehicles</span>
              <div className="text-2xl font-bold">{status.coordinator.cache.vehicleCount}</div>
              <div className="text-xs text-muted-foreground">
                Age: {Math.round(status.coordinator.cache.vehicleAge / 1000)}s
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Cached Positions</span>
              <div className="text-2xl font-bold">{status.coordinator.cache.positionCount}</div>
              <div className="text-xs text-muted-foreground">
                Age: {Math.round(status.coordinator.cache.positionAge / 1000)}s
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Zap className="h-5 w-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>
            Use these controls only when experiencing severe API issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={handleManualRefresh}
              disabled={isRefreshing || status.coordinator.emergencyStop}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Manual Refresh
            </Button>
            
            <Button
              onClick={handleEmergencyReset}
              disabled={isRefreshing}
              variant="destructive"
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Emergency Reset
            </Button>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Emergency Reset</strong> will stop all polling, clear all caches, 
              reset the circuit breaker, and restart the system. Use this if the system 
              is stuck in throttling mode.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}