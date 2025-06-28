
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { map-pin, zap, settings, shield } from 'lucide-react';

interface VehicleCardProps {
  vehicle: {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'maintenance';
    location: string;
    speed: number;
    fuel: number;
    temperature: number;
    lastUpdate: string;
    aiScore: number;
  };
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'offline': return <Badge className="bg-red-100 text-red-800">Offline</Badge>;
      case 'maintenance': return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
      default: return <Badge>Unknown</Badge>;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">{vehicle.name}</CardTitle>
          {getStatusBadge(vehicle.status)}
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(vehicle.status)} ${vehicle.status === 'online' ? 'animate-pulse' : ''}`}></div>
          <span>{vehicle.lastUpdate}</span>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <map-pin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">{vehicle.location}</span>
            </div>
            <span className="font-medium">{vehicle.speed} km/h</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Fuel Level</div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${vehicle.fuel > 50 ? 'bg-green-500' : vehicle.fuel > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${vehicle.fuel}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">{vehicle.fuel}%</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-xs text-slate-500">AI Efficiency</div>
              <div className="flex items-center space-x-2">
                <zap className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-600">{vehicle.aiScore}/100</span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button size="sm" variant="outline" className="flex-1">
              <map-pin className="w-4 h-4 mr-1" />
              Track
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <settings className="w-4 h-4 mr-1" />
              Control
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleCard;
