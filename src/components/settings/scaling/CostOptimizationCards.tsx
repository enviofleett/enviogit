
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Zap } from 'lucide-react';

interface CostOptimizationCardsProps {
  budgetStatus: any;
}

export const CostOptimizationCards: React.FC<CostOptimizationCardsProps> = ({ budgetStatus }) => {
  return (
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
  );
};
