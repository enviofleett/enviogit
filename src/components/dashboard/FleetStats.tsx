
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { monitor, zap, shield, settings } from 'lucide-react';

const FleetStats = () => {
  const stats = [
    {
      title: 'Active Vehicles',
      value: '24',
      change: '+2 from yesterday',
      icon: monitor,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'AI Efficiency Score',
      value: '87%',
      change: '+5% this week',
      icon: zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Maintenance Alerts',
      value: '3',
      change: 'Due within 7 days',
      icon: settings,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      title: 'Geofence Events',
      value: '12',
      change: 'Today',
      icon: shield,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FleetStats;
