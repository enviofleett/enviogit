import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Bell,
  BellOff,
  User,
  Calendar,
  Filter,
  Search
} from 'lucide-react';

interface Alert {
  id: string;
  alert_type: 'test_failure' | 'environment_down' | 'performance_degradation' | 'critical_path_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  test_run_id?: string;
  scenario_id?: string;
  environment: string;
  metadata: any;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  notification_sent: boolean;
  created_at: string;
}

export const AlertsManager = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('active');
  const { toast } = useToast();

  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from('synthetic_monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter === 'active') {
        query = query.is('acknowledged_at', null).is('resolved_at', null);
      } else if (filter === 'acknowledged') {
        query = query.not('acknowledged_at', 'is', null).is('resolved_at', null);
      } else if (filter === 'resolved') {
        query = query.not('resolved_at', 'is', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAlerts(data as Alert[] || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch monitoring alerts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('synthetic_monitoring_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Alert acknowledged",
        variant: "default"
      });

      fetchAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive"
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('synthetic_monitoring_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Alert resolved",
        variant: "default"
      });

      fetchAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive"
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'test_failure': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'environment_down': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'performance_degradation': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'critical_path_failure': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertStatusIcon = (alert: Alert) => {
    if (alert.resolved_at) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (alert.acknowledged_at) {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
  };

  const getAlertStatus = (alert: Alert) => {
    if (alert.resolved_at) return 'resolved';
    if (alert.acknowledged_at) return 'acknowledged';
    return 'active';
  };

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Monitoring Alerts</h3>
          <p className="text-sm text-muted-foreground">
            Monitor and manage synthetic testing alerts
          </p>
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'acknowledged', 'resolved'].map((filterOption) => (
            <Button
              key={filterOption}
              size="sm"
              variant={filter === filterOption ? 'default' : 'outline'}
              onClick={() => setFilter(filterOption as any)}
              className="capitalize"
            >
              {filterOption}
            </Button>
          ))}
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'critical' && !a.resolved_at).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High</p>
                <p className="text-2xl font-bold text-orange-600">
                  {alerts.filter(a => a.severity === 'high' && !a.resolved_at).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {alerts.filter(a => !a.acknowledged_at && !a.resolved_at).length}
                </p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">
                  {alerts.filter(a => a.resolved_at).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Alerts</h3>
              <p className="text-muted-foreground">
                {filter === 'all' 
                  ? 'No monitoring alerts have been generated yet'
                  : `No ${filter} alerts found`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card key={alert.id} className={`${
              alert.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
              alert.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
              alert.severity === 'medium' ? 'border-yellow-200 bg-yellow-50/30' :
              ''
            }`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertTypeIcon(alert.alert_type)}
                    <div>
                      <CardTitle className="text-base">{alert.title}</CardTitle>
                      <CardDescription>{alert.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getAlertStatusIcon(alert)}
                    <Badge className={getSeverityColor(alert.severity)}>
                      {getSeverityIcon(alert.severity)}
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Alert Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-medium capitalize">{alert.alert_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Environment:</span>
                      <p className="font-medium">{alert.environment}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p className="font-medium">{new Date(alert.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Notification:</span>
                      <div className="flex items-center gap-1">
                        {alert.notification_sent ? (
                          <Bell className="h-3 w-3 text-green-600" />
                        ) : (
                          <BellOff className="h-3 w-3 text-gray-600" />
                        )}
                        <span className="font-medium">
                          {alert.notification_sent ? 'Sent' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alert Metadata */}
                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Additional Details</h4>
                      <div className="bg-muted rounded p-3 text-sm font-mono">
                        {JSON.stringify(alert.metadata, null, 2)}
                      </div>
                    </div>
                  )}

                  {/* Acknowledgment/Resolution Info */}
                  {(alert.acknowledged_at || alert.resolved_at) && (
                    <div className="border-t pt-4 space-y-2">
                      {alert.acknowledged_at && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>Acknowledged on {new Date(alert.acknowledged_at).toLocaleString()}</span>
                        </div>
                      )}
                      {alert.resolved_at && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle className="h-4 w-4" />
                          <span>Resolved on {new Date(alert.resolved_at).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    {!alert.acknowledged_at && !alert.resolved_at && (
                      <Button
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        Acknowledge
                      </Button>
                    )}
                    {!alert.resolved_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAlert(alert.id)}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};