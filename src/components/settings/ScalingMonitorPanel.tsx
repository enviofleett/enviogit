import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, Server, DollarSign, Brain, Zap } from 'lucide-react';
import { scalingService, ScalingMetrics } from '@/services/scaling/ScalingService';
import { costOptimizationService } from '@/services/optimization/CostOptimizationService';
import { advancedAnalyticsService } from '@/services/analytics/AdvancedAnalyticsService';

const ScalingMonitorPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<ScalingMetrics>({
    activeVehicles: 0,
    apiCallsPerMinute: 0,
    averageResponseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0
  });
  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  const [optimizationInsights, setOptimizationInsights] = useState<any[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      // Simulate real metrics - in production, these would come from monitoring systems
      const newMetrics = {
        activeVehicles: Math.floor(Math.random() * 3000) + 2000,
        apiCallsPerMinute: Math.floor(Math.random() * 500) + 200,
        averageResponseTime: Math.floor(Math.random() * 1000) + 500,
        errorRate: Math.random() * 0.1,
        memoryUsage: Math.floor(Math.random() * 40) + 60,
        cpuUsage: Math.floor(Math.random() * 30) + 40
      };

      setMetrics(newMetrics);
      scalingService.updateMetrics(newMetrics);

      // Update budget status
      const budget = costOptimizationService.getBudgetStatus();
      setBudgetStatus(budget);

      // Update optimization insights
      const insights = advancedAnalyticsService.generateOptimizationInsights();
      setOptimizationInsights(insights.slice(0, 5)); // Top 5 insights
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value: number, thresholds: { warning: number; critical: number }): "destructive" | "default" | "secondary" | "outline" => {
    if (value >= thresholds.critical) return 'destructive';
    if (value >= thresholds.warning) return 'secondary';
    return 'default';
  };

  const getPriorityColor = (priority: string): "destructive" | "default" | "secondary" | "outline" => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Phase 5: Scale Management</h2>
          <p className="text-muted-foreground">
            Infrastructure scaling, cost optimization, and advanced analytics for 3000+ vehicles
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-3 py-1">
          {metrics.activeVehicles.toLocaleString()} Active Vehicles
        </Badge>
      </div>

      <Tabs defaultValue="scaling" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scaling" className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Infrastructure
          </TabsTrigger>
          <TabsTrigger value="cost" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Cost Optimization
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Advanced Analytics
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Optimization Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scaling" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Calls/Min</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.apiCallsPerMinute}</div>
                <Progress 
                  value={(metrics.apiCallsPerMinute / 1000) * 100} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Target: &lt;1000/min
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.averageResponseTime}ms</div>
                <Badge 
                  variant={getStatusColor(metrics.averageResponseTime, { warning: 1500, critical: 2500 })}
                  className="mt-2"
                >
                  {metrics.averageResponseTime < 1500 ? 'Good' : metrics.averageResponseTime < 2500 ? 'Warning' : 'Critical'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(metrics.errorRate * 100).toFixed(2)}%</div>
                <Progress 
                  value={metrics.errorRate * 1000} 
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Target: &lt;5%
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Current infrastructure resource consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>CPU Usage</span>
                    <span>{metrics.cpuUsage}%</span>
                  </div>
                  <Progress value={metrics.cpuUsage} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Memory Usage</span>
                    <span>{metrics.memoryUsage}%</span>
                  </div>
                  <Progress value={metrics.memoryUsage} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Load Balancing Status</CardTitle>
                <CardDescription>Automatic scaling configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-scaling</span>
                  <Badge variant="outline" className="text-green-700 bg-green-50">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Instances</span>
                  <span className="font-medium">{Math.ceil(metrics.activeVehicles / 1000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Target Load</span>
                  <span className="font-medium">1000 vehicles/instance</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cost" className="space-y-6">
          {budgetStatus && (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {budgetStatus.utilizationPercent.toFixed(1)}%
                    </div>
                    <Progress value={budgetStatus.utilizationPercent} className="mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {budgetStatus.currentUsage.toLocaleString()} / {budgetStatus.monthlyLimit.toLocaleString()} calls
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Projected Usage</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {budgetStatus.projectedMonthlyUsage.toLocaleString()}
                    </div>
                    <Badge 
                      variant={budgetStatus.projectedMonthlyUsage > budgetStatus.monthlyLimit ? 'destructive' : 'default'}
                      className="mt-2"
                    >
                      {budgetStatus.projectedMonthlyUsage > budgetStatus.monthlyLimit ? 'Over Budget' : 'On Track'}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${(budgetStatus.currentUsage * budgetStatus.costPerCall).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      ${budgetStatus.costPerCall} per call
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">73%</div>
                    <Badge variant="outline" className="mt-2 text-green-700 bg-green-50">
                      Optimal
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Optimization Settings</CardTitle>
                  <CardDescription>Configure automatic cost management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Emergency Throttling Trigger</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm">90% of budget</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cache TTL (seconds)</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm">30s (moving) / 5min (stationary)</span>
                        <Badge variant="outline">Adaptive</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Predictive Positioning</CardTitle>
                <CardDescription>AI-powered location prediction for enhanced user experience</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Prediction Accuracy</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <Progress value={87} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Predictions</span>
                    <span className="font-medium">{Math.floor(metrics.activeVehicles * 0.3).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Prediction Window</span>
                    <span className="font-medium">5 minutes</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilization Patterns</CardTitle>
                <CardDescription>Vehicle usage analysis and optimization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">High Utilization</span>
                    <span className="font-medium">{Math.floor(metrics.activeVehicles * 0.4).toLocaleString()} vehicles</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medium Utilization</span>
                    <span className="font-medium">{Math.floor(metrics.activeVehicles * 0.35).toLocaleString()} vehicles</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Low Utilization</span>
                    <span className="font-medium">{Math.floor(metrics.activeVehicles * 0.25).toLocaleString()} vehicles</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4">
                    View Detailed Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Historical performance data and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">94%</div>
                  <div className="text-sm text-muted-foreground">Sync Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">1.2s</div>
                  <div className="text-sm text-muted-foreground">Avg Response Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">73%</div>
                  <div className="text-sm text-muted-foreground">Cache Hit Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">$2,847</div>
                  <div className="text-sm text-muted-foreground">Monthly Cost</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Recommendations</CardTitle>
              <CardDescription>AI-generated insights to improve efficiency and reduce costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optimizationInsights.length > 0 ? (
                  optimizationInsights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <Badge variant={getPriorityColor(insight.priority)}>
                        {insight.priority}
                      </Badge>
                      <div className="flex-1">
                        <div className="font-medium">{insight.recommendation}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Vehicle: {insight.vehicleId} • Type: {insight.type}
                        </div>
                        {insight.potentialSavings !== 0 && (
                          <div className="text-sm mt-2">
                            <span className={insight.potentialSavings > 0 ? 'text-green-600' : 'text-blue-600'}>
                              {insight.potentialSavings > 0 ? 'Saves' : 'Improves'}: {Math.abs(insight.potentialSavings)}
                              {insight.potentialSavings > 0 ? '% cost' : '% accuracy'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Analyzing vehicle patterns...</p>
                    <p className="text-sm mt-2">Optimization insights will appear as data is collected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScalingMonitorPanel;
