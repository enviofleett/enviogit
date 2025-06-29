
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Wifi,
  WifiOff,
  X,
  Settings
} from 'lucide-react';
import { useMonitoringAlerts } from '@/hooks/useMonitoringAlerts';

const MonitoringAlertsPanel: React.FC = () => {
  const {
    alerts,
    apiUsageStats,
    acknowledgeAlert,
    dismissAlert
  } = useMonitoringAlerts();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const usagePercentage = apiUsageStats.dailyLimit > 0 
    ? ((apiUsageStats.totalRequests / apiUsageStats.dailyLimit) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* API Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>API Usage & Performance</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {apiUsageStats.totalRequests.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {((apiUsageStats.successfulRequests / apiUsageStats.totalRequests) * 100 || 0).toFixed(1)}%
              </div>
              <div className="text-sm text-slate-500">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {apiUsageStats.averageResponseTime.toFixed(1)}s
              </div>
              <div className="text-sm text-slate-500">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {apiUsageStats.remainingQuota.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500">Remaining Quota</div>
            </div>
          </div>

          {/* Usage Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Daily API Usage</span>
              <span>{usagePercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(usagePercentage)}`}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500">
              {apiUsageStats.totalRequests.toLocaleString()} / {apiUsageStats.dailyLimit.toLocaleString()} requests used
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Active Alerts</span>
            </div>
            <Badge variant="outline">
              {alerts.length} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-slate-500">No active alerts</p>
              <p className="text-sm text-slate-400">All systems operating normally</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <Alert key={alert.id} className={`${getSeverityColor(alert.severity)} border`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">{alert.title}</h4>
                          <div className="flex items-center space-x-1 text-xs opacity-75">
                            <Clock className="w-3 h-3" />
                            <span>{alert.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <AlertDescription className="text-sm">
                          {alert.message}
                        </AlertDescription>
                        {alert.vehicleName && (
                          <div className="mt-2 text-xs">
                            <Badge variant="outline" className="text-xs">
                              {alert.vehicleName}
                            </Badge>
                          </div>
                        )}
                        {alert.metadata && (
                          <div className="mt-2 text-xs space-y-1">
                            {alert.type === 'vehicle_offline' && alert.metadata.lastSeen && (
                              <div>Last seen: {new Date(alert.metadata.lastSeen).toLocaleString()}</div>
                            )}
                            {alert.type === 'api_limit' && (
                              <div>
                                Usage: {alert.metadata.usagePercentage?.toFixed(1)}% 
                                ({alert.metadata.remainingQuota?.toLocaleString()} remaining)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="h-6 w-6 p-0"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => dismissAlert(alert.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">WebSocket Connection</span>
              </div>
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">GPS51 API</span>
              </div>
              <Badge className="bg-green-100 text-green-800">Operational</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">Sync Jobs</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">Active</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Intelligent Filtering</span>
              </div>
              <Badge className="bg-purple-100 text-purple-800">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoringAlertsPanel;
