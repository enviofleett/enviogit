import { useState } from 'react';
import { X, Info, Route, BarChart3, FileText, MoreHorizontal, MapPin, Clock, Gauge, Battery, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { GPS51Device } from '@/services/gps51/direct';

interface VehicleDetailsPanelProps {
  vehicle: GPS51Device;
  onClose: () => void;
}

export const VehicleDetailsPanel = ({ vehicle, onClose }: VehicleDetailsPanelProps) => {
  const [activeTab, setActiveTab] = useState('info');

  const getVehicleStatus = (): 'online' | 'idle' | 'offline' => {
    const now = Date.now();
    const lastActiveTime = vehicle.lastactivetime || 0;
    const minutesSinceUpdate = (now - lastActiveTime) / (1000 * 60);
    
    if (minutesSinceUpdate > 240) return 'offline'; // 4 hours
    if ((vehicle.speed || 0) > 5) return 'online';
    return 'idle';
  };

  const formatCoordinate = (coord: number | undefined): string => {
    if (!coord || coord === 0) return 'N/A';
    return coord.toFixed(6);
  };

  const formatLastUpdate = (timestamp: number | undefined): string => {
    if (!timestamp) return 'No data available';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} hours ago`;
    
    return date.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'idle':
        return <Badge variant="secondary">Idle</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const status = getVehicleStatus();

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold">{vehicle.devicename || `Device ${vehicle.deviceid}`}</h3>
            <p className="text-sm text-muted-foreground">ID: {vehicle.deviceid}</p>
          </div>
          {getStatusBadge(status)}
        </div>
        
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Info
          </TabsTrigger>
          <TabsTrigger value="track" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Track
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="more" className="flex items-center gap-2">
            <MoreHorizontal className="h-4 w-4" />
            More
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 p-4">
          <TabsContent value="info" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Position */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm">Position</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Latitude</div>
                    <div className="font-mono text-sm">{formatCoordinate(vehicle.callat)}</div>
                    <div className="text-xs text-muted-foreground">Longitude</div>
                    <div className="font-mono text-sm">{formatCoordinate(vehicle.callon)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Speed & Heading */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm">Speed & Heading</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Speed</div>
                    <div className="text-sm font-semibold">
                      {vehicle.speed ? `${Math.round(vehicle.speed)} mph` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground">Heading</div>
                    <div className="text-sm font-semibold">
                      {vehicle.course ? `${Math.round(vehicle.course)}°` : 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Device Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Signal className="h-4 w-4 text-purple-600" />
                    <span className="font-medium text-sm">Device Info</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Type</div>
                    <div className="text-sm">{vehicle.devicetype || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">SIM</div>
                    <div className="text-sm font-mono">{vehicle.simnum || 'N/A'}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Last Update */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-medium text-sm">Last Update</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Activity</div>
                    <div className="text-sm">{formatLastUpdate(vehicle.lastactivetime)}</div>
                    <div className="text-xs text-muted-foreground">Position</div>
                    <div className="text-sm">{formatLastUpdate(vehicle.updatetime)}</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator className="my-4" />

            {/* Additional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Technical Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Battery Level:</span>
                      <span>{(vehicle as any).voltagepercent ? `${(vehicle as any).voltagepercent}%` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signal Level:</span>
                      <span>{(vehicle as any).rxlevel || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GPS Satellites:</span>
                      <span>{(vehicle as any).gpsnum || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Moving:</span>
                      <span>{vehicle.moving ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-3">Status Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span>{vehicle.strstatus || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Allow Edit:</span>
                      <span>{vehicle.allowedit ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Is Free:</span>
                      <span>{vehicle.isfree ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="track" className="mt-0">
            <Card>
              <CardContent className="p-6 text-center">
                <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Track History</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Historical tracking data for this vehicle
                </p>
                <Button variant="outline" disabled>
                  Load Track History
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <Card>
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Statistics</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Performance and usage statistics
                </p>
                <Button variant="outline" disabled>
                  View Statistics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-0">
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Event Logs</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Recent events and alerts for this vehicle
                </p>
                <Button variant="outline" disabled>
                  View Event Logs
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="more" className="mt-0">
            <Card>
              <CardContent className="p-6 text-center">
                <MoreHorizontal className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Additional Options</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  More vehicle management options
                </p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" disabled>
                    Send Command
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Configure Alerts
                  </Button>
                  <Button variant="outline" className="w-full" disabled>
                    Export Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};