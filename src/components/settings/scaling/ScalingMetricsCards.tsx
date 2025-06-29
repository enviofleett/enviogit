
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp, Server } from 'lucide-react';
import { ScalingMetrics } from '@/services/scaling/ScalingService';

interface ScalingMetricsCardsProps {
  metrics: ScalingMetrics;
  getStatusColor: (value: number, thresholds: { warning: number; critical: number }) => "destructive" | "default" | "secondary" | "outline";
}

export const ScalingMetricsCards: React.FC<ScalingMetricsCardsProps> = ({ metrics, getStatusColor }) => {
  return (
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
  );
};
