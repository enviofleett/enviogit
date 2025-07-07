
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, Fuel, Thermometer, Wifi, WifiOff } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';

const RealTimeMap: React.FC = () => {
  const { state, actions } = useGPS51Data();
  const vehicles = state.devices;
  const loading = state.isLoading;
  const error = state.error;
  const refresh = actions.refreshData;
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const vehiclesWithGPS = vehicles.filter(v => v.latest_position);
  const vehiclesWithoutGPS = vehicles.filter(v => !v.latest_position);

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
            <div className="text-slate-500">Loading fleet data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-red-600" />
            <span>Real-time Vehicle Tracking</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-red-50 rounded-lg">
            <div className="text-red-500 text-center">
              <p>Error: {error}</p>
              <button 
                onClick={refresh}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
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
            <span>Fleet Overview</span>
          </div>
          <div className="text-sm text-slate-600 flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Wifi className="w-4 h-4 text-green-600" />
              <span>{vehiclesWithGPS.length} GPS</span>
            </div>
            <div className="flex items-center space-x-1">
              <WifiOff className="w-4 h-4 text-slate-400" />
              <span>{vehiclesWithoutGPS.length} offline</span>
            </div>
            <span>{vehicles.length} total</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Map placeholder */}
          <div className="h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500 font-medium">Interactive Map</p>
              <p className="text-sm text-slate-400">
                {vehiclesWithGPS.length > 0 
                  ? `${vehiclesWithGPS.length} vehicles with live GPS tracking`
                  : 'No vehicles with GPS data available'
                }
              </p>
            </div>
          </div>

          {/* Vehicle list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-slate-900">Fleet Status</h4>
              <button 
                onClick={refresh}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
            
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-500">No vehicles found. Click "Sync GPS51" to load data.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* Vehicles with GPS first */}
                {vehiclesWithGPS.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVehicle === vehicle.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-green-200 hover:border-green-300 bg-green-50/50'
                    }`}
                    onClick={() => setSelectedVehicle(
                      selectedVehicle === vehicle.id ? null : vehicle.id
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${
                            vehicle.latest_position?.isMoving
                              ? 'bg-green-500 animate-pulse' 
                              : 'bg-yellow-500'
                          }`}></div>
                          <Wifi className="w-4 h-4 text-green-600" />
                        </div>
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
                          <span>{Math.round(vehicle.latest_position?.speed || 0)} km/h</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {vehicle.latest_position?.isMoving ? 'Moving' : 'Stopped'}
                        </p>
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
                          <span className="text-slate-500">Speed:</span>
                          <p>{Math.round(vehicle.latest_position.speed)} km/h</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Direction:</span>
                          <p>{vehicle.latest_position.heading ? Math.round(vehicle.latest_position.heading) : 'N/A'}°</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Last Update:</span>
                          <p>{new Date(vehicle.latest_position.timestamp).toLocaleTimeString()}</p>
                        </div>
                        {vehicle.latest_position.fuel_level && (
                          <div className="flex items-center space-x-1">
                            <Fuel className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">Fuel:</span>
                            <p>{Math.round(vehicle.latest_position.fuel_level)}%</p>
                          </div>
                        )}
                        {vehicle.latest_position.engine_temperature && (
                          <div className="flex items-center space-x-1">
                            <Thermometer className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">Engine:</span>
                            <p>{Math.round(vehicle.latest_position.engine_temperature)}°C</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Vehicles without GPS */}
                {vehiclesWithoutGPS.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <WifiOff className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">
                            {vehicle.license_plate}
                          </p>
                          <p className="text-sm text-slate-500">
                            {vehicle.brand} {vehicle.model}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">No GPS data</p>
                        <p className="text-xs text-slate-400">
                          Status: {vehicle.status}
                        </p>
                      </div>
                    </div>
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
