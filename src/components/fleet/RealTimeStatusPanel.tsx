/**
 * Real-time Status Panel
 * Shows system status and polling information
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Wifi,
  Database,
  Timer
} from 'lucide-react';

interface RealTimeStatusPanelProps {
  isPolling: boolean;
  pollingInterval: number;
  serviceStatus: any;
  lastUpdate: Date | null;
}

const RealTimeStatusPanel: React.FC<RealTimeStatusPanelProps> = ({
  isPolling,
  pollingInterval,
  serviceStatus,
  lastUpdate
}) => {
  const formatInterval = (ms: number) => {
    return `${Math.round(ms / 1000)}s`;
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    
    return date.toLocaleTimeString();
  };

  const getStatusColor = (isHealthy: boolean) => {
    return isHealthy ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5" />
          <span>Real-time System Status</span>
        </CardTitle>
        <CardDescription>
          Monitor system health and data synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Polling Status */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <Timer className="w-4 h-4" />
              <span>Data Polling</span>
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <Badge variant={isPolling ? 'default' : 'secondary'}>
                  {isPolling ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                      Active
                    </>
                  ) : (
                    'Paused'
                  )}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Interval</span>
                <span className="text-sm font-medium">{formatInterval(pollingInterval)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Update</span>
                <span className="text-sm font-medium">{formatLastUpdate(lastUpdate)}</span>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <Wifi className="w-4 h-4" />
              <span>GPS51 Connection</span>
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Authentication</span>
                <div className={`flex items-center space-x-1 ${getStatusColor(serviceStatus?.isAuthenticated)}`}>
                  {getStatusIcon(serviceStatus?.isAuthenticated)}
                  <span className="text-sm font-medium">
                    {serviceStatus?.isAuthenticated ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Username</span>
                <span className="text-sm font-medium">
                  {serviceStatus?.username || 'None'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API Health</span>
                <Badge variant="default" className="bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Healthy
                </Badge>
              </div>
            </div>
          </div>

          {/* Fleet Statistics */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Fleet Data</span>
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Devices</span>
                <span className="text-sm font-medium">{serviceStatus?.deviceCount || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Moving</span>
                <Badge variant="default" className="bg-green-100 text-green-700">
                  {serviceStatus?.movingVehicles || 0}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Stationary</span>
                <Badge variant="secondary">
                  {serviceStatus?.stationaryVehicles || 0}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Offline</span>
                <Badge variant={serviceStatus?.offlineVehicles > 0 ? 'destructive' : 'secondary'}>
                  {serviceStatus?.offlineVehicles || 0}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* System Health Indicator */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">System Health</span>
            <Badge 
              variant={serviceStatus?.isAuthenticated ? 'default' : 'destructive'}
              className={serviceStatus?.isAuthenticated ? 'bg-green-100 text-green-700' : ''}
            >
              {serviceStatus?.isAuthenticated ? 'Operational' : 'Degraded'}
            </Badge>
          </div>
          
          <Progress 
            value={serviceStatus?.isAuthenticated ? 100 : 25} 
            className="h-2"
          />
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>System Status</span>
            <span>
              {serviceStatus?.isAuthenticated ? '100% Operational' : 'Service Unavailable'}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        {serviceStatus?.pollingRecommendation && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Smart Polling Active
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {serviceStatus.pollingRecommendation.reason} - 
                  polling every {formatInterval(serviceStatus.pollingRecommendation.interval)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeStatusPanel;