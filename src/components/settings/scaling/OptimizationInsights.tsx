
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';

interface OptimizationInsightsProps {
  optimizationInsights: any[];
  getPriorityColor: (priority: string) => "destructive" | "default" | "secondary" | "outline";
}

export const OptimizationInsights: React.FC<OptimizationInsightsProps> = ({ 
  optimizationInsights, 
  getPriorityColor 
}) => {
  return (
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
  );
};
