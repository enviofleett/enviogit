
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScalingMetrics } from '@/services/scaling/ScalingService';

interface AnalyticsCardsProps {
  metrics: ScalingMetrics;
}

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ metrics }) => {
  return (
    <>
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
    </>
  );
};
