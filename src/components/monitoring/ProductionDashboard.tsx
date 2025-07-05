import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { productionMonitoringService, SystemMetrics, Alert as MonitoringAlert } from '@/services/monitoring/ProductionMonitoringService';
import { getCurrentEnvironment, getEnvironmentConfig } from '@/config/environment';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Car, 
  Zap, 
  Clock,
  Shield,
  Database,
  Wifi
} from 'lucide-react';

export function ProductionDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'5m' | '1h' | '24h'>('1h');

  useEffect(() => {
    const initializeMonitoring = async () => {
      try {
        await productionMonitoringService.initialize();
        setIsInitialized(true);
        
        // Get initial data
        const latestMetrics = productionMonitoringService.getLatestMetrics();
        const activeAlerts = productionMonitoringService.getActiveAlerts();
        
        setMetrics(latestMetrics);
        setAlerts(activeAlerts);
        
        // Subscribe to alerts
        const unsubscribe = productionMonitoringService.onAlert((alert) => {
          setAlerts(prev => [...prev, alert]);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize production monitoring:', error);
      }
    };

    const cleanup = initializeMonitoring();
    
    // Update metrics periodically
    const interval = setInterval(() => {
      const latestMetrics = productionMonitoringService.getLatestMetrics();
      const activeAlerts = productionMonitoringService.getActiveAlerts();
      
      setMetrics(latestMetrics);
      setAlerts(activeAlerts);
    }, 15000); // Update every 15 seconds

    return () => {
      clearInterval(interval);
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const getStatusColor = (value: number, threshold: number, invert = false) => {
    const isGood = invert ? value < threshold : value > threshold;
    return isGood ? 'text-green-600' : value > threshold * 0.8 ? 'text-yellow-600' : 'text-red-600';
  };

  const getStatusIcon = (value: number, threshold: number, invert = false) => {
    const isGood = invert ? value < threshold : value > threshold;
    return isGood ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  const formatMetric = (value: number, unit: string) => {
    if (unit === 'ms') {
      return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    if (unit === 'rps') {
      return `${value.toFixed(1)}/s`;
    }
    return `${Math.round(value)}${unit}`;
  };

  const environment = getCurrentEnvironment();
  const config = getEnvironmentConfig();
  const criticalAlerts = alerts.filter(a => a.level === 'critical' && !a.resolved);
  const warningAlerts = alerts.filter(a => a.level === 'warning' && !a.resolved);

  if (!isInitialized || !metrics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Activity className="h-8 w-8 mx-auto mb-4 animate-pulse" />
            <p>Initializing production monitoring...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Environment Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Production Dashboard</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={environment === 'production' ? 'default' : 'secondary'}>
              {environment.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
          </select>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}</strong>
            <div className="mt-2 space-y-1">
              {criticalAlerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="text-sm">
                  • {alert.title}: {alert.message}
                </div>
              ))}
              {criticalAlerts.length > 3 && (
                <div className="text-sm">+ {criticalAlerts.length - 3} more alerts</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Availability</p>
                <p className={`text-2xl font-bold ${getStatusColor(metrics.availability.healthScore, 95)}`}>
                  {formatMetric(metrics.availability.healthScore, '%')}
                </p>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Time</p>
                <p className={`text-2xl font-bold ${getStatusColor(metrics.performance.averageResponseTime, config.alerts.thresholds.responseTime, true)}`}>
                  {formatMetric(metrics.performance.averageResponseTime, 'ms')}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className={`text-2xl font-bold ${getStatusColor(metrics.performance.errorRate, config.alerts.thresholds.errorRate, true)}`}>
                  {formatMetric(metrics.performance.errorRate, '%')}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.business.activeUsers}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.filter(a => !a.resolved).length})</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Authentication</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Database</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span>GPS51 Integration</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Real-time Updates</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Resource Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Memory Usage</span>
                  <span className="font-medium">{formatMetric(metrics.resources.memoryUsage, '%')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Network Latency</span>
                  <span className="font-medium">{formatMetric(metrics.resources.networkLatency, 'ms')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Connections</span>
                  <span className="font-medium">{metrics.resources.activeConnections}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Average</span>
                  <span className="font-medium">{formatMetric(metrics.performance.averageResponseTime, 'ms')}</span>
                </div>
                <div className="flex justify-between">
                  <span>95th Percentile</span>
                  <span className="font-medium">{formatMetric(metrics.performance.p95ResponseTime, 'ms')}</span>
                </div>
                <div className="flex justify-between">
                  <span>99th Percentile</span>
                  <span className="font-medium">{formatMetric(metrics.performance.p99ResponseTime, 'ms')}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Requests/sec</span>
                  <span className="font-medium">{formatMetric(metrics.performance.requestsPerSecond, 'rps')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-medium">{formatMetric(metrics.performance.errorRate, '%')}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Errors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-medium">{metrics.errors.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Critical</span>
                  <span className="font-medium text-red-600">{metrics.errors.critical}</span>
                </div>
                <div className="flex justify-between">
                  <span>Warnings</span>
                  <span className="font-medium text-yellow-600">{metrics.errors.warnings}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.filter(a => !a.resolved).length === 0 ? (
            <Card>
              <CardContent className="text-center p-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                <h3 className="text-lg font-medium mb-2">No Active Alerts</h3>
                <p className="text-muted-foreground">All systems are operating normally</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.filter(a => !a.resolved).map(alert => (
                <Alert key={alert.id} variant={alert.level === 'critical' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div>
                        <strong>{alert.title}</strong>
                        <p className="mt-1">{alert.message}</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          {alert.service} • {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => productionMonitoringService.resolveAlert(alert.id)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold">{metrics.business.activeUsers}</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Car className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold">{metrics.business.vehiclesOnline}</div>
                <div className="text-sm text-muted-foreground">Vehicles Online</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold">{metrics.business.commandsExecuted}</div>
                <div className="text-sm text-muted-foreground">Commands Executed</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <div className="text-2xl font-bold">{metrics.business.dataPointsProcessed}</div>
                <div className="text-sm text-muted-foreground">Data Points</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}