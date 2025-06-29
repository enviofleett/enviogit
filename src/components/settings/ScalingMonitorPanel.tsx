
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server, DollarSign, Brain, Zap } from 'lucide-react';
import { scalingService, ScalingMetrics } from '@/services/scaling/ScalingService';
import { costOptimizationService } from '@/services/optimization/CostOptimizationService';
import { advancedAnalyticsService } from '@/services/analytics/AdvancedAnalyticsService';
import { ScalingMetricsCards } from './scaling/ScalingMetricsCards';
import { ResourceUsageCard } from './scaling/ResourceUsageCard';
import { LoadBalancingCard } from './scaling/LoadBalancingCard';
import { CostOptimizationCards } from './scaling/CostOptimizationCards';
import { AnalyticsCards } from './scaling/AnalyticsCards';
import { OptimizationInsights } from './scaling/OptimizationInsights';

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
          <ScalingMetricsCards metrics={metrics} getStatusColor={getStatusColor} />
          
          <div className="grid gap-6 md:grid-cols-2">
            <ResourceUsageCard metrics={metrics} />
            <LoadBalancingCard metrics={metrics} />
          </div>
        </TabsContent>

        <TabsContent value="cost" className="space-y-6">
          {budgetStatus && (
            <CostOptimizationCards budgetStatus={budgetStatus} />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsCards metrics={metrics} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <OptimizationInsights 
            optimizationInsights={optimizationInsights}
            getPriorityColor={getPriorityColor}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScalingMonitorPanel;
