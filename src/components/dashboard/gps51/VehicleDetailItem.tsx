
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Navigation, 
  MapPin, 
  Fuel, 
  Thermometer, 
  Battery, 
  AlertTriangle, 
  Wifi,
  WifiOff,
  Clock,
  Gauge
} from 'lucide-react';
import { VehicleWithEnhancedData } from '@/hooks/useGPS51VehicleData';

interface VehicleDetailItemProps {
  vehicleData: VehicleWithEnhancedData;
}

const VehicleDetailItem: React.FC<VehicleDetailItemProps> = ({ vehicleData }) => {
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        vehicleData.isOnline 
          ? 'border-green-200 bg-green-50/30' 
          : 'border-gray-200 bg-gray-50/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            vehicleData.isMoving 
              ? 'bg-green-500 animate-pulse' 
              : vehicleData.isOnline 
                ? 'bg-yellow-500' 
                : 'bg-gray-400'
          }`} />
          {vehicleData.isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-400" />
          )}
          <div>
            <p className="font-medium">{vehicleData.device.devicename}</p>
            <p className="text-sm text-gray-500">ID: {vehicleData.device.deviceid}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {vehicleData.hasAlarms && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
          <Badge variant={vehicleData.isOnline ? "default" : "secondary"}>
            {vehicleData.isMoving ? 'Moving' : vehicleData.isOnline ? 'Parked' : 'Offline'}
          </Badge>
        </div>
      </div>

      {vehicleData.position && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-gray-600">Speed:</span>
              <p className="font-medium">{Math.round(vehicleData.position.speed)} km/h</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-gray-600">Position:</span>
              <p className="font-mono text-xs">
                {vehicleData.position.callat.toFixed(4)}, {vehicleData.position.callon.toFixed(4)}
              </p>
            </div>
          </div>

          {vehicleData.fuelLevel !== undefined && (
            <div className="flex items-center space-x-2">
              <Fuel className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-600">Fuel:</span>
                <div className="flex items-center space-x-1">
                  <Progress value={vehicleData.fuelLevel} className="w-12 h-2" />
                  <span className="text-xs">{vehicleData.fuelLevel}%</span>
                </div>
              </div>
            </div>
          )}

          {vehicleData.temperature !== undefined && (
            <div className="flex items-center space-x-2">
              <Thermometer className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-600">Temp:</span>
                <p className="font-medium">{vehicleData.temperature}°C</p>
              </div>
            </div>
          )}

          {vehicleData.batteryLevel !== undefined && (
            <div className="flex items-center space-x-2">
              <Battery className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-600">Battery:</span>
                <p className="font-medium">{vehicleData.batteryLevel}%</p>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-gray-600">Distance:</span>
              <p className="font-medium">{Math.round((vehicleData.position.totaldistance || 0) / 1000)} km</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-gray-600">Last Seen:</span>
              <p className="font-medium">{formatLastUpdate(vehicleData.lastSeen)}</p>
            </div>
          </div>

          {vehicleData.position.strstatus && (
            <div className="col-span-2">
              <span className="text-gray-600">Status:</span>
              <p className="font-medium text-sm">{vehicleData.position.strstatus}</p>
            </div>
          )}
        </div>
      )}

      {vehicleData.hasAlarms && vehicleData.position?.stralarm && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-800">Active Alarm:</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{vehicleData.position.stralarm}</p>
        </div>
      )}
    </div>
  );
};

export default VehicleDetailItem;
