import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Heart, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Wifi,
  Server
} from 'lucide-react';
import { gps51HealthMonitor, GPS51SystemHealth } from '@/services/gps51/GPS51HealthMonitor';

export function GPS51HealthStatus() {
  const [health, setHealth] = useState<GPS51SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refreshHealth = async (forceFresh = false) => {
    setIsLoading(true);
    try {
      const healthData = await gps51HealthMonitor.getCurrentHealth(forceFresh);
      setHealth(healthData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh health status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load cached health on mount
    const cached = gps51HealthMonitor.getCachedHealth();
    if (cached) {
      setHealth(cached);
      setLastRefresh(new Date(cached.lastUpdate));
    } else {
      refreshHealth();
    }
  }, []);

  const getStatusIcon = (healthy: boolean) => {
    return healthy ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getOverallIcon = (overall: string) => {
    switch (overall) {
      case 'healthy':
        return <Heart className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes('Edge Function')) {
      return <Server className="h-4 w-4" />;
    }
    if (serviceName.includes('API')) {
      return <Wifi className="h-4 w-4" />;
    }
    return <CheckCircle className="h-4 w-4" />;
  };

  const summary = health ? gps51HealthMonitor.getHealthSummary(health) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {health ? getOverallIcon(health.overall) : <Clock className="h-5 w-5" />}
            GPS51 System Health
          </span>
          <Button
            onClick={() => refreshHealth(true)}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {health && summary ? (
          <>
            <Alert variant={summary.color === 'red' ? 'destructive' : summary.color === 'yellow' ? 'default' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{summary.status}</strong>: {summary.message}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">Service Status</h4>
              {health.checks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    {getServiceIcon(check.service)}
                    <span className="font-medium">{check.service}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={check.healthy ? "default" : "destructive"}>
                      {check.healthy ? 'Healthy' : 'Unhealthy'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {check.responseTime}ms
                    </span>
                    {getStatusIcon(check.healthy)}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-sm text-muted-foreground">
              Last updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
            </div>

            {health.checks.some(check => !check.healthy && check.error) && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Error Details</h4>
                {health.checks
                  .filter(check => !check.healthy && check.error)
                  .map((check, index) => (
                    <div key={index} className="p-2 bg-red-50 rounded text-sm">
                      <strong>{check.service}:</strong> {check.error}
                    </div>
                  ))
                }
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking system health...
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-muted-foreground">Health status not available</p>
                <Button onClick={() => refreshHealth(true)} size="sm">
                  Check System Health
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}