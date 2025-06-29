
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Navigation, Fuel, Thermometer, Wifi, WifiOff } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';

const RealTimeMap: React.FC = () => {
  const { devices, positions, loading, error, refresh } = useGPS51Data();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const devicesWithGPS = devices.filter(d => d.last_seen_at);
  const devicesWithoutGPS = devices.filter(d => !d.last_seen_at);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <span>Real-time Device Tracking</span>
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
            <span>Real-time Device Tracking</span>
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
              <span>{devicesWithGPS.length} GPS</span>
            </div>
            <div className="flex items-center space-x-1">
              <WifiOff className="w-4 h-4 text-slate-400" />
              <span>{devicesWithoutGPS.length} offline</span>
            </div>
            <span>{devices.length} total</span>
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
                {devicesWithGPS.length > 0 
                  ? `${devicesWithGPS.length} devices with live GPS tracking`
                  : 'No devices with GPS data available'
                }
              </p>
            </div>
          </div>

          {/* Device list */}
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
            
            {devices.length === 0 ? (
              <p className="text-sm text-slate-500">No devices found. Configure GPS51 sync to load data.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* Devices with GPS first */}
                {devicesWithGPS.map((device) => {
                  const latestPosition = positions.find(p => p.device_id === device.device_id);
                  return (
                    <div
                      key={device.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedDevice === device.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-green-200 hover:border-green-300 bg-green-50/50'
                      }`}
                      onClick={() => setSelectedDevice(
                        selectedDevice === device.id ? null : device.id
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${
                              latestPosition?.ignition_on
                                ? 'bg-green-500 animate-pulse' 
                                : 'bg-yellow-500'
                            }`}></div>
                            <Wifi className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {device.device_name || device.device_id}
                            </p>
                            <p className="text-sm text-slate-500">
                              Device ID: {device.device_id}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-1 text-sm text-slate-600">
                            <Navigation className="w-4 h-4" />
                            <span>{Math.round(latestPosition?.speed_kph || 0)} km/h</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {latestPosition?.ignition_on ? 'Moving' : 'Stopped'}
                          </p>
                        </div>
                      </div>
                      
                      {selectedDevice === device.id && latestPosition && (
                        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Position:</span>
                            <p className="font-mono text-xs">
                              {Number(latestPosition.latitude).toFixed(6)}, {Number(latestPosition.longitude).toFixed(6)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Speed:</span>
                            <p>{Math.round(Number(latestPosition.speed_kph || 0))} km/h</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Direction:</span>
                            <p>{latestPosition.heading ? Math.round(latestPosition.heading) : 'N/A'}°</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Last Update:</span>
                            <p>{new Date(latestPosition.timestamp).toLocaleTimeString()}</p>
                          </div>
                          {latestPosition.battery_voltage && (
                            <div className="flex items-center space-x-1">
                              <span className="text-slate-500">Battery:</span>
                              <p>{Number(latestPosition.battery_voltage).toFixed(1)}V</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Devices without GPS */}
                {devicesWithoutGPS.map((device) => (
                  <div
                    key={device.id}
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
                            {device.device_name || device.device_id}
                          </p>
                          <p className="text-sm text-slate-500">
                            Device ID: {device.device_id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">No GPS data</p>
                        <p className="text-xs text-slate-400">
                          Offline
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
