
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { zap, bell, settings } from 'lucide-react';

const AIInsights = () => {
  const insights = [
    {
      type: 'maintenance',
      title: 'Predictive Maintenance Alert',
      description: 'Vehicle VH-001 shows 85% probability of brake service needed within 30 days',
      priority: 'high',
      action: 'Schedule Service',
      icon: settings
    },
    {
      type: 'efficiency',
      title: 'Route Optimization Opportunity',
      description: 'Route efficiency can be improved by 15% for delivery vehicles in Zone A',
      priority: 'medium',
      action: 'Optimize Routes',
      icon: zap
    },
    {
      type: 'behavior',
      title: 'Driver Behavior Analysis',
      description: 'Driver performance improved by 12% after implementing eco-driving recommendations',
      priority: 'low',
      action: 'View Details',
      icon: bell
    }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <zap className="w-5 h-5 text-blue-600" />
          <span>AI Insights & Recommendations</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">{insight.title}</h4>
                    <Badge className={getPriorityColor(insight.priority)}>
                      {insight.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{insight.description}</p>
                  <Button size="sm" variant="outline" className="mt-2">
                    {insight.action}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIInsights;
