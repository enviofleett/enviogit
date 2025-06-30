
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Monitor, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { gps51Client, GPS51Device, GPS51Group } from '@/services/gps51/GPS51Client';
import { useToast } from '@/hooks/use-toast';

interface DeviceManagerState {
  devices: GPS51Device[];
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  searchTerm: string;
}

const GPS51DeviceManager: React.FC = () => {
  const { toast } = useToast();
  const [state, setState] = useState<DeviceManagerState>({
    devices: [],
    loading: false,
    error: null,
    lastSync: null,
    searchTerm: ''
  });

  const fetchDevices = async () => {
    if (!gps51Client.isAuthenticated()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Not authenticated. Please configure GPS51 credentials first.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('Fetching GPS51 device list...');
      const devices = await gps51Client.getDeviceList();
      
      setState(prev => ({
        ...prev,
        devices,
        loading: false,
        lastSync: new Date(),
        error: null
      }));

      toast({
        title: "Device List Updated",
        description: `Successfully retrieved ${devices.length} devices`,
      });

      console.log('Device fetch successful:', {
        deviceCount: devices.length,
        devices: devices.map(d => ({ id: d.deviceid, name: d.devicename, type: d.devicetype }))
      });
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));

      toast({
        title: "Error",
        description: `Failed to fetch devices: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Auto-fetch devices if authenticated
    if (gps51Client.isAuthenticated()) {
      fetchDevices();
    }
  }, []);

  const filteredDevices = state.devices.filter(device => 
    device.devicename.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    device.deviceid.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    device.devicetype.toLowerCase().includes(state.searchTerm.toLowerCase())
  );

  const getDeviceStatusBadge = (device: GPS51Device) => {
    if (device.status === 1) {
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    } else if (device.status === 0) {
      return <Badge variant="secondary">Inactive</Badge>;
    } else {
      return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastActiveTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="w-5 h-5" />
            <span>GPS51 Device Management</span>
          </CardTitle>
          <CardDescription>
            View and manage devices from your GPS51 account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={state.searchTerm}
                  onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-8 w-64"
                />
              </div>
              <Button
                onClick={fetchDevices}
                disabled={state.loading || !gps51Client.isAuthenticated()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${state.loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {state.lastSync && (
                <span className="text-sm text-muted-foreground">
                  Last updated: {state.lastSync.toLocaleTimeString()}
                </span>
              )}
              {gps51Client.isAuthenticated() ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>

          {state.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-xs text-red-600 mt-1">{state.error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device ID</TableHead>
                  <TableHead>Device Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SIM Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Loading devices...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {state.devices.length === 0 ? 'No devices found' : 'No devices match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.deviceid}>
                      <TableCell className="font-mono text-sm">{device.deviceid}</TableCell>
                      <TableCell className="font-medium">{device.devicename}</TableCell>
                      <TableCell>{device.devicetype}</TableCell>
                      <TableCell className="font-mono text-sm">{device.simnum}</TableCell>
                      <TableCell>{getDeviceStatusBadge(device)}</TableCell>
                      <TableCell className="text-sm">
                        {formatLastActiveTime(device.lastactivetime)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {device.remark || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {filteredDevices.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {filteredDevices.length} of {state.devices.length} devices
              </span>
              <div className="flex items-center space-x-4">
                <span>Active: {state.devices.filter(d => d.status === 1).length}</span>
                <span>Inactive: {state.devices.filter(d => d.status === 0).length}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51DeviceManager;
