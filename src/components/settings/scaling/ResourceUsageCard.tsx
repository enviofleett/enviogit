
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScalingMetrics } from '@/services/scaling/ScalingService';

interface ResourceUsageCardProps {
  metrics: ScalingMetrics;
}

export const ResourceUsageCard: React.FC<ResourceUsageCardProps> = ({ metrics }) => {
  return (
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
  );
};
