
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';

const RealTimeMap: React.FC = () => {
  const { vehicles, loading } = useGPS51Data();
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const activeVehicles = vehicles.filter(v => 
    v.status === 'available' && v.latest_position
  );

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Real-time Vehicle Tracking</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-slate-500">Loading GPS data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Real-time Vehicle Tracking</span>
          </div>
          <div className="text-sm text-slate-600">
            {activeVehicles.length} vehicles active
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Map placeholder - in production this would be integrated with a mapping service */}
          <div className="h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500 font-medium">Interactive Map</p>
              <p className="text-sm text-slate-400">GPS51 vehicle positions will be displayed here</p>
            </div>
          </div>

          {/* Vehicle list with real GPS data */}
          <div className="space-y-2">
            <h4 className="font-medium text-slate-900">Active Vehicles</h4>
            {activeVehicles.length === 0 ? (
              <p className="text-sm text-slate-500">No active vehicles with GPS data</p>
            ) : (
              <div className="space-y-2">
                {activeVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVehicle === vehicle.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedVehicle(
                      selectedVehicle === vehicle.id ? null : vehicle.id
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {vehicle.license_plate}
                          </p>
                          <p className="text-sm text-slate-500">
                            {vehicle.brand} {vehicle.model}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1 text-sm text-slate-600">
                          <Navigation className="w-4 h-4" />
                          <span>{vehicle.latest_position?.speed || 0} km/h</span>
                        </div>
                        {vehicle.latest_position && (
                          <p className="text-xs text-slate-400">
                            {new Date(vehicle.latest_position.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {selectedVehicle === vehicle.id && vehicle.latest_position && (
                      <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Position:</span>
                          <p className="font-mono text-xs">
                            {vehicle.latest_position.latitude.toFixed(6)}, {vehicle.latest_position.longitude.toFixed(6)}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Heading:</span>
                          <p>{vehicle.latest_position.heading}°</p>
                        </div>
                        {vehicle.latest_position.fuel_level && (
                          <div>
                            <span className="text-slate-500">Fuel:</span>
                            <p>{vehicle.latest_position.fuel_level}%</p>
                          </div>
                        )}
                        {vehicle.latest_position.engine_temperature && (
                          <div>
                            <span className="text-slate-500">Engine Temp:</span>
                            <p>{vehicle.latest_position.engine_temperature}°C</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeMap;
