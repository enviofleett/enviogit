
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Zap, Settings, Wifi, WifiOff } from 'lucide-react';

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
    hasGPS?: boolean;
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

  const hasGPSData = vehicle.hasGPS !== false && vehicle.location !== 'Unknown' && vehicle.lastUpdate !== 'No data';

  return (
    <Card className={`hover:shadow-lg transition-shadow duration-200 border-slate-200 ${
      !hasGPSData ? 'bg-slate-50/50' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg font-semibold text-slate-900">{vehicle.name}</CardTitle>
            {hasGPSData ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-400" />
            )}
          </div>
          {getStatusBadge(vehicle.status)}
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(vehicle.status)} ${vehicle.status === 'online' ? 'animate-pulse' : ''}`}></div>
          <span>{hasGPSData ? vehicle.lastUpdate : 'No GPS data'}</span>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <MapPin className={`w-4 h-4 ${hasGPSData ? 'text-slate-400' : 'text-slate-300'}`} />
              <span className={`${hasGPSData ? 'text-slate-600' : 'text-slate-400'}`}>
                {hasGPSData ? vehicle.location : 'Location unknown'}
              </span>
            </div>
            <span className={`font-medium ${hasGPSData ? 'text-slate-900' : 'text-slate-400'}`}>
              {hasGPSData ? `${vehicle.speed} km/h` : '-- km/h'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Fuel Level</div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      hasGPSData && vehicle.fuel > 0
                        ? vehicle.fuel > 50 ? 'bg-green-500' : vehicle.fuel > 25 ? 'bg-yellow-500' : 'bg-red-500'
                        : 'bg-slate-300'
                    }`}
                    style={{ width: hasGPSData && vehicle.fuel > 0 ? `${vehicle.fuel}%` : '0%' }}
                  ></div>
                </div>
                <span className={`text-sm font-medium ${hasGPSData ? 'text-slate-900' : 'text-slate-400'}`}>
                  {hasGPSData && vehicle.fuel > 0 ? `${vehicle.fuel}%` : '--'}
                </span>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-xs text-slate-500">AI Efficiency</div>
              <div className="flex items-center space-x-2">
                <Zap className={`w-4 h-4 ${hasGPSData ? 'text-blue-500' : 'text-slate-300'}`} />
                <span className={`text-sm font-medium ${hasGPSData ? 'text-blue-600' : 'text-slate-400'}`}>
                  {hasGPSData ? `${vehicle.aiScore}/100` : '--'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2 pt-2">
            <Button 
              size="sm" 
              variant="outline" 
              className={`flex-1 ${!hasGPSData ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!hasGPSData}
            >
              <MapPin className="w-4 h-4 mr-1" />
              {hasGPSData ? 'Track' : 'No GPS'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              <Settings className="w-4 h-4 mr-1" />
              Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleCard;
