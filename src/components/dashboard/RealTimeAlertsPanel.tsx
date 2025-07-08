import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle,
  Settings,
  Bell,
  BellOff,
  X,
  AlertCircle,
  Fuel,
  Thermometer,
  Battery,
  Gauge
} from 'lucide-react';
import { gps51RealTimeAlertsManager, ActiveAlert, AlertRule } from '@/services/gps51/GPS51RealTimeAlertsManager';
import { gps51EventBus } from '@/services/gps51/realtime/GPS51EventBus';

export const RealTimeAlertsPanel: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<ActiveAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertStats, setAlertStats] = useState({
    totalRules: 0,
    enabledRules: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    acknowledgedAlerts: 0,
    historySize: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(true);

  useEffect(() => {
    // Load initial data
    refreshAlerts();

    // Listen for alert events
    const handleAlertTriggered = (event: any) => {
      refreshAlerts();
      
      // Show browser notification for critical alerts
      if (event.severity === 'critical' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(`GPS51 Critical Alert`, {
            body: event.message,
            icon: '/favicon.ico',
            tag: event.id
          });
        }
      }
    };

    const handleAlertResolved = (event: any) => {
      refreshAlerts();
    };

    gps51EventBus.on('gps51.alert.triggered', handleAlertTriggered);
    gps51EventBus.on('gps51.alert.resolved', handleAlertResolved);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAlerts, 30000);

    return () => {
      gps51EventBus.off('gps51.alert.triggered');
      gps51EventBus.off('gps51.alert.resolved');
      clearInterval(interval);
    };
  }, []);

  const refreshAlerts = () => {
    setActiveAlerts(gps51RealTimeAlertsManager.getActiveAlerts());
    setAlertHistory(gps51RealTimeAlertsManager.getAlertHistory(20));
    setAlertRules(gps51RealTimeAlertsManager.getRules());
    setAlertStats(gps51RealTimeAlertsManager.getAlertStats());
  };

  const acknowledgeAlert = (alertId: string) => {
    gps51RealTimeAlertsManager.acknowledgeAlert(alertId);
    refreshAlerts();
  };

  const toggleRuleEnabled = (ruleId: string, enabled: boolean) => {
    gps51RealTimeAlertsManager.updateRule(ruleId, { enabled });
    refreshAlerts();
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'speed': return Gauge;
      case 'fuel': return Fuel;
      case 'temperature': return Thermometer;
      case 'battery': return Battery;
      case 'panic': return AlertTriangle;
      default: return AlertCircle;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Shield className="w-6 h-6" />
            <span>Real-Time Alerts</span>
            {alertStats.activeAlerts > 0 && (
              <Badge variant="destructive" className="ml-2 animate-pulse">
                {alertStats.activeAlerts} Active
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground">
            Live monitoring and alerts for fleet safety and performance
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={isMonitoring ? "default" : "outline"}
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Monitoring
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                Paused
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAlerts}
          >
            <Settings className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{alertStats.criticalAlerts}</div>
                <p className="text-sm text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-2xl font-bold">{alertStats.warningAlerts}</div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{alertStats.acknowledgedAlerts}</div>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{alertStats.enabledRules}</div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {alertStats.criticalAlerts > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <span className="font-medium">
                {alertStats.criticalAlerts} Critical Alert{alertStats.criticalAlerts !== 1 ? 's' : ''} Require Immediate Attention
              </span>
            </div>
            <div className="space-y-1">
              {activeAlerts.filter(a => a.severity === 'critical').slice(0, 3).map((alert) => (
                <div key={alert.id} className="text-sm flex items-center justify-between">
                  <span><strong>{alert.vehicleName}:</strong> {alert.message}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active Alerts ({alertStats.activeAlerts})
          </TabsTrigger>
          <TabsTrigger value="history">
            Alert History
          </TabsTrigger>
          <TabsTrigger value="rules">
            Alert Rules ({alertStats.totalRules})
          </TabsTrigger>
        </TabsList>

        {/* Active Alerts Tab */}
        <TabsContent value="active" className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-lg font-medium text-green-600">All Systems Normal</p>
                  <p className="text-muted-foreground">No active alerts at this time</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => {
                const IconComponent = getAlertIcon(alert.type);
                return (
                  <Card key={alert.id} className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-red-500 bg-red-50' :
                    alert.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-50' :
                    'border-l-blue-500 bg-blue-50'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <IconComponent className={`w-6 h-6 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{alert.vehicleName}</span>
                              <Badge variant={getSeverityColor(alert.severity) as any}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {alert.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.message}
                            </p>
                            <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(alert.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                          {!alert.acknowledged && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlert(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Alert History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="space-y-3">
            {alertHistory.map((alert) => {
              const IconComponent = getAlertIcon(alert.type);
              return (
                <Card key={alert.id} className="opacity-75">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{alert.vehicleName}</span>
                            <Badge variant="outline" className="text-xs">
                              {alert.type}
                            </Badge>
                            {alert.resolvedAt && (
                              <Badge variant="outline" className="text-green-600">
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>Triggered: {formatTimestamp(alert.timestamp)}</span>
                            </div>
                            {alert.resolvedAt && (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="w-3 h-3" />
                                <span>Resolved: {formatTimestamp(alert.resolvedAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <Badge variant={getSeverityColor(alert.severity) as any}>
                        {alert.severity}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="space-y-3">
            {alertRules.map((rule) => {
              const IconComponent = getAlertIcon(rule.type);
              return (
                <Card key={rule.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{rule.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {rule.type}
                            </Badge>
                            <Badge variant={getSeverityColor(rule.severity) as any}>
                              {rule.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {rule.description}
                          </p>
                          <div className="text-xs text-muted-foreground mt-2">
                            Condition: {rule.condition.field} {rule.condition.operator} {rule.condition.value}
                            {rule.condition.duration && ` for ${rule.condition.duration / 1000}s`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant={rule.enabled ? "default" : "outline"}
                          onClick={() => toggleRuleEnabled(rule.id, !rule.enabled)}
                        >
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};