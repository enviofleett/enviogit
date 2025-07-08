import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Fuel, 
  TrendingDown, 
  TrendingUp, 
  AlertCircle,
  Droplets
} from 'lucide-react';

interface LiveFuelTrackerProps {
  vehicleId: string;
  vehicleName: string;
  currentFuelLevel?: number; // percentage (0-100)
  fuelConsumptionRate?: number; // L/100km
  estimatedRange?: number; // km
  isMoving: boolean;
  lastUpdate: number;
  tankCapacity?: number; // liters
  className?: string;
}

export const LiveFuelTracker: React.FC<LiveFuelTrackerProps> = ({
  vehicleId,
  vehicleName,
  currentFuelLevel = 0,
  fuelConsumptionRate = 8.5,
  estimatedRange = 0,
  isMoving,
  lastUpdate,
  tankCapacity = 50,
  className
}) => {
  // Calculate fuel status
  const getFuelStatus = () => {
    if (currentFuelLevel <= 10) return { status: 'critical', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (currentFuelLevel <= 25) return { status: 'low', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (currentFuelLevel >= 90) return { status: 'full', color: 'text-green-600', bgColor: 'bg-green-50' };
    return { status: 'normal', color: 'text-blue-600', bgColor: 'bg-blue-50' };
  };

  const fuelStatus = getFuelStatus();

  // Calculate estimated liters remaining
  const litersRemaining = (currentFuelLevel / 100) * tankCapacity;

  // Format consumption trend
  const getConsumptionTrend = () => {
    if (!isMoving) return null;
    
    // Simulate consumption trend based on rate
    if (fuelConsumptionRate > 12) return { trend: 'high', icon: TrendingUp, color: 'text-red-500' };
    if (fuelConsumptionRate < 6) return { trend: 'efficient', icon: TrendingDown, color: 'text-green-500' };
    return { trend: 'normal', icon: Droplets, color: 'text-blue-500' };
  };

  const consumptionTrend = getConsumptionTrend();

  // Format last update time
  const formatLastUpdate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card className={`${className} ${fuelStatus.bgColor} border-l-4 ${
      fuelStatus.status === 'critical' ? 'border-l-red-500' :
      fuelStatus.status === 'low' ? 'border-l-yellow-500' :
      fuelStatus.status === 'full' ? 'border-l-green-500' : 'border-l-blue-500'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate flex items-center space-x-2">
            <Fuel className="w-4 h-4" />
            <span>{vehicleName}</span>
          </CardTitle>
          
          {fuelStatus.status === 'critical' && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertCircle className="w-3 h-3 mr-1" />
              Low Fuel
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Fuel Level Display */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${fuelStatus.color} flex items-center justify-center space-x-2`}>
            <span>{currentFuelLevel.toFixed(1)}%</span>
          </div>
          
          <div className="text-sm text-muted-foreground mt-1">
            ~{litersRemaining.toFixed(1)}L remaining
          </div>
        </div>

        {/* Fuel Level Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={currentFuelLevel} 
            className={`h-3 ${
              fuelStatus.status === 'critical' ? '[&>div]:bg-red-500' :
              fuelStatus.status === 'low' ? '[&>div]:bg-yellow-500' :
              fuelStatus.status === 'full' ? '[&>div]:bg-green-500' : '[&>div]:bg-blue-500'
            }`}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Empty</span>
            <span>Tank: {tankCapacity}L</span>
            <span>Full</span>
          </div>
        </div>

        {/* Consumption Info */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {fuelConsumptionRate.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">L/100km</div>
            
            {consumptionTrend && (
              <div className={`flex items-center justify-center space-x-1 mt-1 ${consumptionTrend.color}`}>
                <consumptionTrend.icon className="w-3 h-3" />
                <span className="text-xs capitalize">{consumptionTrend.trend}</span>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {estimatedRange}
            </div>
            <div className="text-xs text-muted-foreground">km range</div>
            
            {estimatedRange < 50 && estimatedRange > 0 && (
              <div className="flex items-center justify-center space-x-1 mt-1 text-yellow-600">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">Low range</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex justify-between items-center text-xs pt-2 border-t">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              isMoving ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-muted-foreground">
              {isMoving ? 'Consuming fuel' : 'Engine off'}
            </span>
          </div>
          
          <span className="text-muted-foreground">
            {formatLastUpdate(lastUpdate)}
          </span>
        </div>

        {/* Fuel Alerts */}
        {fuelStatus.status === 'critical' && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Critical fuel level! Find nearest gas station.
              </span>
            </div>
          </div>
        )}

        {fuelStatus.status === 'low' && (
          <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-yellow-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Low fuel level. Consider refueling soon.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};