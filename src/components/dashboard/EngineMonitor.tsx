import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Thermometer, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  TrendingDown,
  Snowflake
} from 'lucide-react';

interface EngineMonitorProps {
  vehicleId: string;
  vehicleName: string;
  engineTemperature: number; // Celsius
  oilPressure?: number; // PSI
  coolantLevel?: number; // percentage
  isEngineOn: boolean;
  lastUpdate: number;
  normalTempRange?: [number, number]; // [min, max] in Celsius
  className?: string;
}

export const EngineMonitor: React.FC<EngineMonitorProps> = ({
  vehicleId,
  vehicleName,
  engineTemperature,
  oilPressure = 0,
  coolantLevel = 100,
  isEngineOn,
  lastUpdate,
  normalTempRange = [85, 105],
  className
}) => {
  // Calculate temperature status
  const getTempStatus = () => {
    if (!isEngineOn) return { status: 'off', color: 'text-gray-500', bgColor: 'bg-gray-50' };
    if (engineTemperature > normalTempRange[1] + 10) return { status: 'overheating', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (engineTemperature > normalTempRange[1]) return { status: 'hot', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    if (engineTemperature < normalTempRange[0] - 10) return { status: 'cold', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    return { status: 'normal', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  const tempStatus = getTempStatus();

  // Calculate temperature percentage for progress bar (0-150°C range)
  const tempPercentage = Math.min((engineTemperature / 150) * 100, 100);

  // Get oil pressure status
  const getOilPressureStatus = () => {
    if (!isEngineOn) return { status: 'off', color: 'text-gray-500' };
    if (oilPressure < 10) return { status: 'low', color: 'text-red-600' };
    if (oilPressure < 20) return { status: 'warning', color: 'text-yellow-600' };
    return { status: 'normal', color: 'text-green-600' };
  };

  const oilStatus = getOilPressureStatus();

  // Get coolant level status
  const getCoolantStatus = () => {
    if (coolantLevel < 20) return { status: 'low', color: 'text-red-600' };
    if (coolantLevel < 50) return { status: 'warning', color: 'text-yellow-600' };
    return { status: 'normal', color: 'text-green-600' };
  };

  const coolantStatus = getCoolantStatus();

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

  // Get temperature icon based on status
  const getTempIcon = () => {
    switch (tempStatus.status) {
      case 'cold': return Snowflake;
      case 'overheating': return AlertTriangle;
      case 'hot': return TrendingUp;
      case 'normal': return CheckCircle;
      default: return Thermometer;
    }
  };

  const TempIcon = getTempIcon();

  return (
    <Card className={`${className} ${tempStatus.bgColor} border-l-4 ${
      tempStatus.status === 'overheating' ? 'border-l-red-500' :
      tempStatus.status === 'hot' ? 'border-l-yellow-500' :
      tempStatus.status === 'cold' ? 'border-l-blue-500' :
      tempStatus.status === 'normal' ? 'border-l-green-500' : 'border-l-gray-400'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate flex items-center space-x-2">
            <Thermometer className="w-4 h-4" />
            <span>{vehicleName}</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {tempStatus.status === 'overheating' && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Overheating
              </Badge>
            )}
            
            <div className={`w-2 h-2 rounded-full ${
              isEngineOn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Temperature Display */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${tempStatus.color} flex items-center justify-center space-x-2`}>
            <TempIcon className="w-6 h-6" />
            <span>{engineTemperature}°C</span>
          </div>
          
          <div className="text-sm text-muted-foreground mt-1">
            Normal: {normalTempRange[0]}-{normalTempRange[1]}°C
          </div>
        </div>

        {/* Temperature Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={tempPercentage} 
            className={`h-3 ${
              tempStatus.status === 'overheating' ? '[&>div]:bg-red-500' :
              tempStatus.status === 'hot' ? '[&>div]:bg-yellow-500' :
              tempStatus.status === 'cold' ? '[&>div]:bg-blue-500' :
              tempStatus.status === 'normal' ? '[&>div]:bg-green-500' : '[&>div]:bg-gray-400'
            }`}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0°C</span>
            <span>Normal Range</span>
            <span>150°C</span>
          </div>
        </div>

        {/* Engine Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {/* Oil Pressure */}
          <div className="text-center">
            <div className={`text-lg font-semibold ${oilStatus.color}`}>
              {oilPressure.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Oil PSI</div>
            
            <div className={`flex items-center justify-center space-x-1 mt-1 ${oilStatus.color}`}>
              {oilStatus.status === 'low' && <AlertTriangle className="w-3 h-3" />}
              {oilStatus.status === 'warning' && <TrendingDown className="w-3 h-3" />}
              {oilStatus.status === 'normal' && <CheckCircle className="w-3 h-3" />}
              <span className="text-xs capitalize">{oilStatus.status}</span>
            </div>
          </div>
          
          {/* Coolant Level */}
          <div className="text-center">
            <div className={`text-lg font-semibold ${coolantStatus.color}`}>
              {coolantLevel}%
            </div>
            <div className="text-xs text-muted-foreground">Coolant</div>
            
            <div className={`flex items-center justify-center space-x-1 mt-1 ${coolantStatus.color}`}>
              {coolantStatus.status === 'low' && <AlertTriangle className="w-3 h-3" />}
              {coolantStatus.status === 'warning' && <TrendingDown className="w-3 h-3" />}
              {coolantStatus.status === 'normal' && <CheckCircle className="w-3 h-3" />}
              <span className="text-xs capitalize">{coolantStatus.status}</span>
            </div>
          </div>
        </div>

        {/* Engine Status */}
        <div className="flex justify-between items-center text-xs pt-2 border-t">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Engine:</span>
            <Badge variant={isEngineOn ? "default" : "secondary"} className="text-xs">
              {isEngineOn ? 'Running' : 'Off'}
            </Badge>
          </div>
          
          <span className="text-muted-foreground">
            {formatLastUpdate(lastUpdate)}
          </span>
        </div>

        {/* Critical Alerts */}
        {tempStatus.status === 'overheating' && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Engine overheating! Stop immediately to prevent damage.
              </span>
            </div>
          </div>
        )}

        {oilStatus.status === 'low' && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Low oil pressure! Check oil level immediately.
              </span>
            </div>
          </div>
        )}

        {coolantStatus.status === 'low' && (
          <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Low coolant level detected.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};