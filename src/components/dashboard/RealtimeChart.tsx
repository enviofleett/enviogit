
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RealtimeChart = () => {
  const data = [
    { time: '10:00', vehicles: 18, efficiency: 85 },
    { time: '10:15', vehicles: 22, efficiency: 87 },
    { time: '10:30', vehicles: 24, efficiency: 89 },
    { time: '10:45', vehicles: 26, efficiency: 86 },
    { time: '11:00', vehicles: 24, efficiency: 91 },
    { time: '11:15', vehicles: 28, efficiency: 88 },
    { time: '11:30', vehicles: 30, efficiency: 92 },
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Real-time Fleet Performance</CardTitle>
        <div className="flex items-center space-x-4 text-sm text-slate-600">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Active Vehicles</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>AI Efficiency %</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="vehicles" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="efficiency" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealtimeChart;
