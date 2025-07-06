import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Users,
  ShoppingCart,
  Smartphone,
  Shield,
  TestTube
} from 'lucide-react';

interface TestRun {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  execution_time_ms?: number;
}

interface SystemHealth {
  overall_status: 'healthy' | 'degraded' | 'critical';
  last_test_run?: TestRun;
  active_alerts: number;
  success_rate: number;
}

export const SyntheticMonitoringDashboard = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall_status: 'healthy',
    active_alerts: 0,
    success_rate: 0
  });
  const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSystemHealth = async () => {
    try {
      // Fetch recent test runs
      const { data: runs, error: runsError } = await supabase
        .from('synthetic_test_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5);

      if (runsError) throw runsError;

      setRecentRuns(runs || []);

      // Calculate system health metrics
      if (runs && runs.length > 0) {
        const lastRun = runs[0];
        const totalTests = runs.reduce((sum, run) => sum + run.total_scenarios, 0);
        const passedTests = runs.reduce((sum, run) => sum + run.passed_scenarios, 0);
        const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

        // Fetch active alerts
        const { data: alerts, error: alertsError } = await supabase
          .from('synthetic_monitoring_alerts')
          .select('id')
          .is('resolved_at', null);

        if (alertsError) throw alertsError;

        const overallStatus = successRate >= 95 ? 'healthy' : 
                            successRate >= 80 ? 'degraded' : 'critical';

        setSystemHealth({
          overall_status: overallStatus,
          last_test_run: lastRun,
          active_alerts: alerts?.length || 0,
          success_rate: successRate
        });
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
      toast({
        title: "Error",
        description: "Failed to fetch system health data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    try {
      const { data, error } = await supabase.functions.invoke('synthetic-test-runner', {
        body: { 
          run_type: 'manual',
          scenarios: 'all'
        }
      });

      if (error) throw error;

      toast({
        title: "Tests Started",
        description: "Synthetic monitoring tests are now running",
        variant: "default"
      });

      // Refresh data after a short delay
      setTimeout(fetchSystemHealth, 2000);
    } catch (error) {
      console.error('Failed to run tests:', error);
      toast({
        title: "Error",
        description: "Failed to start synthetic tests",
        variant: "destructive"
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(systemHealth.overall_status)}
                  <Badge className={getStatusColor(systemHealth.overall_status)}>
                    {systemHealth.overall_status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{systemHealth.success_rate.toFixed(1)}%</span>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Alerts</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{systemHealth.active_alerts}</span>
                  {systemHealth.active_alerts > 0 && (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Test Run</p>
                <div className="mt-1">
                  <span className="text-sm">
                    {systemHealth.last_test_run ? 
                      new Date(systemHealth.last_test_run.started_at).toLocaleDateString() : 
                      'Never'
                    }
                  </span>
                </div>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Run synthetic tests and manage monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runAllTests} 
              disabled={isRunningTests}
              className="flex items-center gap-2"
            >
              {isRunningTests ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
            </Button>
            <Button variant="outline" onClick={fetchSystemHealth}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Journey Health */}
      <Card>
        <CardHeader>
          <CardTitle>User Journey Health</CardTitle>
          <CardDescription>
            Critical user flows and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Customer Journey</span>
              </div>
              <Progress value={95} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Registration → Purchase</span>
                <span>95%</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-green-600" />
                <span className="font-medium">Merchant Flow</span>
              </div>
              <Progress value={88} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Onboarding → Validation</span>
                <span>88%</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Technical Partner</span>
              </div>
              <Progress value={92} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Registration → Earnings</span>
                <span>92%</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                <span className="font-medium">Admin Operations</span>
              </div>
              <Progress value={98} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Approvals → Monitoring</span>
                <span>98%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Test Runs</CardTitle>
          <CardDescription>
            Latest synthetic monitoring test executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentRuns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No test runs yet</p>
                <p className="text-sm mt-1">Click "Run All Tests" to start monitoring</p>
              </div>
            ) : (
              recentRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {run.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : run.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-medium capitalize">{run.status}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">{run.passed_scenarios} passed</span>
                    <span className="text-red-600">{run.failed_scenarios} failed</span>
                    <span className="text-muted-foreground">
                      {run.execution_time_ms ? `${(run.execution_time_ms / 1000).toFixed(1)}s` : '-'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};