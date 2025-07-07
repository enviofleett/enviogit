import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, MapPin, Car, Users, Wifi, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import type { GPS51Device, GPS51Position } from '@/services/gps51/direct';
import type { UseGPS51DirectConnectionState } from '@/hooks/useGPS51DirectConnection';
export interface SmartPollingState {
  isActive: boolean;
  currentInterval: number;
  activeDevices: number;
  inactiveDevices: number;
  lastAdaptation: number;
  pollingEfficiency: number;
}
import type { MetricsSnapshot } from '@/hooks/useGPS51MetricsTracker';

interface GPS51DirectStatusCardsProps {
  vehicles: GPS51Device[];
  positions: GPS51Position[];
  connection: UseGPS51DirectConnectionState;
  smartPolling: SmartPollingState;
  metrics: MetricsSnapshot;
}

export const GPS51DirectStatusCards: React.FC<GPS51DirectStatusCardsProps> = ({
  vehicles,
  positions,
  connection,
  smartPolling,
  metrics
}) => {
  // Calculate vehicle statistics
  const totalVehicles = vehicles.length;
  const now = Date.now();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);
  const fourHoursAgo = now - (4 * 60 * 60 * 1000);

  const onlineVehicles = vehicles.filter(v => 
    v.lastactivetime && v.lastactivetime > fourHoursAgo
  ).length;

  const activeVehicles = vehicles.filter(v => 
    v.lastactivetime && v.lastactivetime > thirtyMinutesAgo
  ).length;

  const movingVehicles = positions.filter(p => 
    p.speed !== undefined && p.speed > 5 // Moving faster than 5 km/h
  ).length;

  // Calculate connection quality color
  const getConnectionColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  // Format polling interval
  const formatPollingInterval = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  // Get performance status
  const getPerformanceStatus = () => {
    if (metrics.performance.successRate >= 95) return { color: 'text-green-600', status: 'Excellent' };
    if (metrics.performance.successRate >= 85) return { color: 'text-blue-600', status: 'Good' };
    if (metrics.performance.successRate >= 70) return { color: 'text-yellow-600', status: 'Fair' };
    return { color: 'text-red-600', status: 'Poor' };
  };

  const performanceStatus = getPerformanceStatus();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Fleet Overview */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Overview</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalVehicles}</div>
          <div className="text-xs text-muted-foreground mb-3">Total Vehicles</div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Online</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs font-medium">{onlineVehicles}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Active (30m)</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-xs font-medium">{activeVehicles}</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Moving</span>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium">{movingVehicles}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connection</CardTitle>
          <Wifi className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getConnectionColor(connection.quality)}`}>
            {connection.quality}
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {connection.latency}ms latency
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge 
                variant={connection.isHealthy ? "default" : "destructive"}
                className="text-xs h-5"
              >
                {connection.status}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Health</span>
              <span className="text-xs font-medium">
                {connection.isHealthy ? '100%' : '0%'}
              </span>
            </div>
            
            {connection.errorCount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Errors</span>
                <span className="text-xs font-medium text-red-600">
                  {connection.errorCount}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Smart Polling */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Smart Polling</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatPollingInterval(smartPolling.currentInterval)}
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Current Interval
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge 
                variant={smartPolling.isActive ? "default" : "secondary"}
                className="text-xs h-5"
              >
                {smartPolling.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Efficiency</span>
              <span className={`text-xs font-medium ${
                smartPolling.pollingEfficiency > 80 ? 'text-green-600' :
                smartPolling.pollingEfficiency > 60 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {smartPolling.pollingEfficiency}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Active Devices</span>
              <span className="text-xs font-medium">
                {smartPolling.activeDevices}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${performanceStatus.color}`}>
            {performanceStatus.status}
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {metrics.performance.successRate}% success rate
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Avg Response</span>
              <span className={`text-xs font-medium ${
                metrics.performance.averageResponseTime < 2000 ? 'text-green-600' :
                metrics.performance.averageResponseTime < 5000 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {metrics.performance.averageResponseTime}ms
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Requests</span>
              <span className="text-xs font-medium">
                {metrics.performance.totalRequests}
              </span>
            </div>
            
            {metrics.alerts.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Alerts</span>
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3 h-3 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-600">
                    {metrics.alerts.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};