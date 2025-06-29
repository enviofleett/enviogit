
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useGPS51LiveData, LiveDataOptions } from '@/hooks/useGPS51LiveData';

const GPS51LiveTrackingEnhanced: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const liveDataOptions: LiveDataOptions = {
    enabled: true,
    refreshInterval: 15000, // More frequent updates for live tracking
    maxRetries: 5
  };

  const { positions, metrics, loading, error, refresh } = useGPS51LiveData(liveDataOptions);

  const filteredPositions = positions.filter(position => {
    const matchesSearch = position.deviceid.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'moving' && position.moving === 1) ||
      (filterStatus === 'stopped' && position.moving === 0);
    
    return matchesSearch && matchesFilter;
  });

  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDevice(selectedDevice === deviceId ? null : deviceId);
  };

  const getStatusBadge = (moving: number) => {
    return moving === 1 ? (
      <Badge className="bg-green-100 text-green-800">Moving</Badge>
    ) : (
      <Badge className="bg-yellow-100 text-yellow-800">Stopped</Badge>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">GPS51 Live Tracking</h1>
        <div className="flex items-center space-x-2">
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="all">All Devices</option>
                <option value="moving">Moving Only</option>
                <option value="stopped">Stopped Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.totalDevices}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.activeDevices}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{metrics.movingVehicles}</div>
              <div className="text-sm text-gray-500">Moving</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics.parkedDevices}</div>
              <div className="text-sm text-gray-500">Parked</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics.offlineVehicles}</div>
              <div className="text-sm text-gray-500">Offline</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Live Device Positions ({filteredPositions.length})</span>
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-red-600 p-4 bg-red-50 rounded-lg mb-4">
              Error: {error}
            </div>
          )}

          <div className="space-y-2">
            {filteredPositions.map((position) => (
              <div
                key={position.deviceid}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedDevice === position.deviceid ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleDeviceSelect(position.deviceid)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      position.moving === 1 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                    }`}></div>
                    <div>
                      <p className="font-medium">Device {position.deviceid}</p>
                      <p className="text-sm text-gray-500">
                        Last Update: {formatTimestamp(position.updatetime)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium">{Math.round(position.speed)} km/h</p>
                      <p className="text-sm text-gray-500">Speed</p>
                    </div>
                    {getStatusBadge(position.moving)}
                  </div>
                </div>

                {selectedDevice === position.deviceid && (
                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Latitude:</span>
                      <p className="font-mono">{position.callat.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Longitude:</span>
                      <p className="font-mono">{position.callon.toFixed(6)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Course:</span>
                      <p>{position.course}°</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Altitude:</span>
                      <p>{position.altitude}m</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Accuracy:</span>
                      <p>{position.radius}m</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <p>{position.strstatus}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPositions.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No devices match your search criteria'
                  : 'No GPS51 devices found. Connect to GPS51 to see live tracking data.'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51LiveTrackingEnhanced;
