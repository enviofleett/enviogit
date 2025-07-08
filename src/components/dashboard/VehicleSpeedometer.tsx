import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle 
} from 'lucide-react';

interface VehicleSpeedometerProps {
  vehicleId: string;
  vehicleName: string;
  currentSpeed: number;
  maxSpeed?: number;
  speedLimit?: number;
  isMoving: boolean;
  lastUpdate: number;
  className?: string;
}

export const VehicleSpeedometer: React.FC<VehicleSpeedometerProps> = ({
  vehicleId,
  vehicleName,
  currentSpeed,
  maxSpeed = 120,
  speedLimit = 80,
  isMoving,
  lastUpdate,
  className
}) => {
  // Calculate speed percentage for progress bar
  const speedPercentage = Math.min((currentSpeed / maxSpeed) * 100, 100);
  
  // Determine speed status
  const getSpeedStatus = () => {
    if (!isMoving) return { status: 'stopped', color: 'text-gray-500', bgColor: 'bg-gray-100' };
    if (currentSpeed > speedLimit) return { status: 'speeding', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (currentSpeed > speedLimit * 0.8) return { status: 'fast', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'normal', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const speedStatus = getSpeedStatus();

  // Format last update time
  const formatLastUpdate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get progress bar color based on speed
  const getProgressColor = () => {
    if (currentSpeed > speedLimit) return 'bg-red-500';
    if (currentSpeed > speedLimit * 0.8) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className={`${className} ${speedStatus.bgColor} border-l-4 ${
      speedStatus.status === 'speeding' ? 'border-l-red-500' :
      speedStatus.status === 'fast' ? 'border-l-yellow-500' :
      speedStatus.status === 'normal' ? 'border-l-green-500' : 'border-l-gray-400'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {vehicleName}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {isMoving ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600">Moving</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-xs text-gray-500">Stopped</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Speed Display */}
        <div className="text-center">
          <div className="relative">
            <div className={`text-3xl font-bold ${speedStatus.color} flex items-center justify-center space-x-2`}>
              <Gauge className="w-6 h-6" />
              <span>{Math.round(currentSpeed)}</span>
              <span className="text-lg">km/h</span>
            </div>
            
            {/* Speed Status Badge */}
            <div className="mt-2">
              <Badge 
                variant={speedStatus.status === 'speeding' ? 'destructive' : 
                       speedStatus.status === 'fast' ? 'secondary' : 'default'}
                className="text-xs"
              >
                {speedStatus.status === 'speeding' && (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Speeding
                  </>
                )}
                {speedStatus.status === 'fast' && (
                  <>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Fast
                  </>
                )}
                {speedStatus.status === 'normal' && isMoving && (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Normal
                  </>
                )}
                {speedStatus.status === 'stopped' && (
                  <>
                    <TrendingDown className="w-3 h-3 mr-1" />
                    Stopped
                  </>
                )}
              </Badge>
            </div>
          </div>
        </div>

        {/* Speed Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>Speed Limit: {speedLimit} km/h</span>
            <span>{maxSpeed}</span>
          </div>
          
          <div className="relative">
            <Progress 
              value={speedPercentage} 
              className="h-2"
            />
            {/* Speed limit indicator */}
            <div 
              className="absolute top-0 w-0.5 h-2 bg-red-400"
              style={{ left: `${(speedLimit / maxSpeed) * 100}%` }}
            />
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
          <span>Last update:</span>
          <span>{formatLastUpdate(lastUpdate)}</span>
        </div>

        {/* Speed Change Indicator */}
        {isMoving && (
          <div className="flex items-center justify-center space-x-2 text-xs">
            {currentSpeed > 20 ? (
              <div className="flex items-center space-x-1 text-blue-600">
                <TrendingUp className="w-3 h-3" />
                <span>Accelerating</span>
              </div>
            ) : currentSpeed > 5 ? (
              <div className="flex items-center space-x-1 text-green-600">
                <span>Cruising</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-yellow-600">
                <TrendingDown className="w-3 h-3" />
                <span>Slowing</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};