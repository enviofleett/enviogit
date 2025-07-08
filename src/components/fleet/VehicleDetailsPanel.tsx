/**
 * Vehicle Details Panel
 * Shows detailed information about a selected vehicle
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  MapPin, 
  Navigation, 
  Clock, 
  Fuel, 
  Thermometer, 
  Zap, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { GPS51Vehicle } from '@/services/gps51/GPS51ProductionService';

interface VehicleDetailsPanelProps {
  vehicle: GPS51Vehicle | null;
  onClose: () => void;
}

const VehicleDetailsPanel: React.FC<VehicleDetailsPanelProps> = ({
  vehicle,
  onClose
}) => {
  if (!vehicle) {
    return (
      <Card className="h-[600px]">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Select a vehicle on the map</p>
            <p className="text-sm">to view detailed information</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string, isMoving: boolean) => {
    if (isMoving) return 'text-green-600 bg-green-50';
    if (status === 'offline') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getStatusIcon = (status: string, isMoving: boolean) => {
    if (isMoving) return <Activity className="w-4 h-4" />;
    if (status === 'offline') return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const formatCoordinate = (coord: number) => {
    return coord.toFixed(6);
  };

  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{vehicle.devicename}</CardTitle>
            <CardDescription className="flex items-center space-x-2 mt-1">
              <span>ID: {vehicle.deviceid}</span>
              {vehicle.simnum && (
                <>
                  <span>•</span>
                  <span>SIM: {vehicle.simnum}</span>
                </>
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2 mt-3">
          <Badge 
            variant="outline" 
            className={getStatusColor(vehicle.status, vehicle.isMoving)}
          >
            {getStatusIcon(vehicle.status, vehicle.isMoving)}
            <span className="ml-1">
              {vehicle.isMoving ? 'Moving' : 
               vehicle.status === 'offline' ? 'Offline' : 'Parked'}
            </span>
          </Badge>
          
          <Badge variant="secondary">
            <Navigation className="w-3 h-3 mr-1" />
            {vehicle.speed} km/h
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* Location Information */}
        {vehicle.position ? (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>Location</span>
            </h4>
            
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-500">Latitude</span>
                  <p className="font-mono">{formatCoordinate(vehicle.position.callat)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Longitude</span>
                  <p className="font-mono">{formatCoordinate(vehicle.position.callon)}</p>
                </div>
              </div>
              
              {vehicle.position.altitude > 0 && (
                <div>
                  <span className="text-gray-500">Altitude</span>
                  <p>{vehicle.position.altitude.toFixed(1)} m</p>
                </div>
              )}
              
              <div>
                <span className="text-gray-500">Accuracy</span>
                <p>{vehicle.position.radius} m</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">No GPS Data</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              This vehicle is not currently reporting location data.
            </p>
          </div>
        )}

        <Separator />

        {/* Vehicle Stats */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Vehicle Stats</span>
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <Navigation className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-900">{vehicle.speed}</p>
              <p className="text-xs text-blue-700">km/h</p>
            </div>
            
            {vehicle.position && (
              <>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <MapPin className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-900">
                    {vehicle.position.course}°
                  </p>
                  <p className="text-xs text-green-700">heading</p>
                </div>
                
                {vehicle.position.totaldistance > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3 text-center col-span-2">
                    <Info className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-purple-900">
                      {(vehicle.position.totaldistance / 1000).toFixed(1)}
                    </p>
                    <p className="text-xs text-purple-700">total km</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Device Information */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Device Status</span>
          </h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium">
                {vehicle.position?.strstatusen || 'Unknown'}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-500">Last Update</span>
              <span className="font-medium">
                {formatLastUpdate(vehicle.lastUpdate)}
              </span>
            </div>
            
            {vehicle.position?.voltagepercent && (
              <div className="flex justify-between">
                <span className="text-gray-500">Battery</span>
                <span className="font-medium">
                  {vehicle.position.voltagepercent}%
                </span>
              </div>
            )}
            
            {vehicle.position?.temp1 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Temperature</span>
                <span className="font-medium">
                  {vehicle.position.temp1}°C
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Alarms */}
        {vehicle.position?.alarm && vehicle.position.alarm > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium flex items-center space-x-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span>Active Alarms</span>
              </h4>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">
                  {vehicle.position.stralarmen || 'Alarm active'}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Alarm code: {vehicle.position.alarm}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleDetailsPanel;