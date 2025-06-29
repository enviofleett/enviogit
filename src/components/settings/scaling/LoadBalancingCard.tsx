
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScalingMetrics } from '@/services/scaling/ScalingService';

interface LoadBalancingCardProps {
  metrics: ScalingMetrics;
}

export const LoadBalancingCard: React.FC<LoadBalancingCardProps> = ({ metrics }) => {
  return (
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
  );
};
