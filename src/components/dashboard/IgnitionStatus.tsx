import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Power, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Car,
  Lock,
  Unlock
} from 'lucide-react';

interface IgnitionStatusProps {
  vehicleId: string;
  vehicleName: string;
  isEngineOn: boolean;
  ignitionState: 'off' | 'accessory' | 'on' | 'start';
  doorsLocked: boolean;
  engineRunTime?: number; // minutes
  lastIgnitionChange: number;
  batteryVoltage?: number;
  className?: string;
}

export const IgnitionStatus: React.FC<IgnitionStatusProps> = ({
  vehicleId,
  vehicleName,
  isEngineOn,
  ignitionState,
  doorsLocked,
  engineRunTime = 0,
  lastIgnitionChange,
  batteryVoltage = 12.6,
  className
}) => {
  // Get ignition status details
  const getIgnitionStatus = () => {
    switch (ignitionState) {
      case 'off':
        return { 
          status: 'Engine Off', 
          color: 'text-gray-500', 
          bgColor: 'bg-gray-50',
          icon: Power,
          borderColor: 'border-l-gray-400'
        };
      case 'accessory':
        return { 
          status: 'Accessory Mode', 
          color: 'text-blue-500', 
          bgColor: 'bg-blue-50',
          icon: Key,
          borderColor: 'border-l-blue-500'
        };
      case 'on':
        return { 
          status: 'Engine Running', 
          color: 'text-green-500', 
          bgColor: 'bg-green-50',
          icon: CheckCircle,
          borderColor: 'border-l-green-500'
        };
      case 'start':
        return { 
          status: 'Starting...', 
          color: 'text-yellow-500', 
          bgColor: 'bg-yellow-50',
          icon: Power,
          borderColor: 'border-l-yellow-500'
        };
      default:
        return { 
          status: 'Unknown', 
          color: 'text-gray-500', 
          bgColor: 'bg-gray-50',
          icon: AlertTriangle,
          borderColor: 'border-l-gray-400'
        };
    }
  };

  const ignitionInfo = getIgnitionStatus();

  // Get battery status
  const getBatteryStatus = () => {
    if (batteryVoltage >= 12.4) return { status: 'good', color: 'text-green-600' };
    if (batteryVoltage >= 12.0) return { status: 'low', color: 'text-yellow-600' };
    return { status: 'critical', color: 'text-red-600' };
  };

  const batteryStatus = getBatteryStatus();

  // Format engine run time
  const formatRunTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Format last change time
  const formatLastChange = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const StatusIcon = ignitionInfo.icon;

  return (
    <Card className={`${className} ${ignitionInfo.bgColor} border-l-4 ${ignitionInfo.borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate flex items-center space-x-2">
            <Car className="w-4 h-4" />
            <span>{vehicleName}</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {/* Lock Status */}
            <Badge variant="outline" className="text-xs">
              {doorsLocked ? (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 mr-1" />
                  Unlocked
                </>
              )}
            </Badge>
            
            {/* Engine Status Indicator */}
            <div className={`w-2 h-2 rounded-full ${
              isEngineOn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Ignition Status Display */}
        <div className="text-center">
          <div className={`text-xl font-bold ${ignitionInfo.color} flex items-center justify-center space-x-2`}>
            <StatusIcon className="w-5 h-5" />
            <span>{ignitionInfo.status}</span>
          </div>
          
          {isEngineOn && engineRunTime > 0 && (
            <div className="text-sm text-muted-foreground mt-1 flex items-center justify-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Running for {formatRunTime(engineRunTime)}</span>
            </div>
          )}
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          {/* Battery Voltage */}
          <div className="text-center">
            <div className={`text-lg font-semibold ${batteryStatus.color}`}>
              {batteryVoltage.toFixed(1)}V
            </div>
            <div className="text-xs text-muted-foreground">Battery</div>
            
            <div className={`flex items-center justify-center space-x-1 mt-1 ${batteryStatus.color}`}>
              {batteryStatus.status === 'critical' && <AlertTriangle className="w-3 h-3" />}
              {batteryStatus.status === 'good' && <CheckCircle className="w-3 h-3" />}
              <span className="text-xs capitalize">{batteryStatus.status}</span>
            </div>
          </div>
          
          {/* Security Status */}
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">
              {doorsLocked ? 'Secure' : 'Open'}
            </div>
            <div className="text-xs text-muted-foreground">Security</div>
            
            <div className={`flex items-center justify-center space-x-1 mt-1 ${
              doorsLocked ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {doorsLocked ? (
                <>
                  <Lock className="w-3 h-3" />
                  <span className="text-xs">Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3" />
                  <span className="text-xs">Unlocked</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Ignition State:</span>
            <Badge variant="secondary" className="text-xs capitalize">
              {ignitionState}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Last Change:</span>
            <span className="text-foreground">{formatLastChange(lastIgnitionChange)}</span>
          </div>
        </div>

        {/* Alerts */}
        {batteryStatus.status === 'critical' && (
          <div className="bg-red-100 border border-red-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Critical battery voltage! Risk of not starting.
              </span>
            </div>
          </div>
        )}

        {batteryStatus.status === 'low' && (
          <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Low battery voltage detected.
              </span>
            </div>
          </div>
        )}

        {!doorsLocked && ignitionState === 'off' && (
          <div className="bg-blue-100 border border-blue-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-blue-700">
              <Unlock className="w-4 h-4" />
              <span className="text-xs font-medium">
                Vehicle is unlocked while engine is off.
              </span>
            </div>
          </div>
        )}

        {isEngineOn && engineRunTime > 300 && ( // 5 hours
          <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-2">
            <div className="flex items-center space-x-2 text-yellow-700">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">
                Engine has been running for over 5 hours.
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};