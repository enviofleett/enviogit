
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor } from 'lucide-react';
import { gps51ProductionService, GPS51Vehicle } from '@/services/gps51/GPS51ProductionService';
import { GPS51Position } from '@/services/gps51/types';
import { useToast } from '@/hooks/use-toast';
import { DeviceSearchControls } from './components/DeviceSearchControls';
import { DeviceErrorDisplay } from './components/DeviceErrorDisplay';

interface EnhancedDeviceData extends GPS51Vehicle {
  lastPosition?: GPS51Position;
}

interface DeviceManagerState {
  devices: EnhancedDeviceData[];
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
    const authState = gps51ProductionService.getAuthState();
    if (!authState.isAuthenticated) {
      setState(prev => ({ 
        ...prev, 
        error: 'Not authenticated. Please configure GPS51 credentials first.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('Fetching GPS51 device list and recent positions...');
      const devices = await gps51ProductionService.fetchUserDevices();
      const enhancedDevices: EnhancedDeviceData[] = devices;
      
      setState(prev => ({
        ...prev,
        devices: enhancedDevices,
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
        devices: devices.map(d => ({ id: d.deviceid, name: d.devicename }))
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
    const authState = gps51ProductionService.getAuthState();
    if (authState.isAuthenticated) {
      fetchDevices();
    }
  }, []);

  const filteredDevices = state.devices.filter(device => 
    device.devicename.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    device.deviceid.toLowerCase().includes(state.searchTerm.toLowerCase())
  );

  const handleSearchChange = (searchTerm: string) => {
    setState(prev => ({ ...prev, searchTerm }));
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
          <DeviceSearchControls
            searchTerm={state.searchTerm}
            onSearchChange={handleSearchChange}
            onRefresh={fetchDevices}
            loading={state.loading}
            isAuthenticated={gps51ProductionService.getAuthState().isAuthenticated}
            lastSync={state.lastSync}
          />

          {state.error && <DeviceErrorDisplay error={state.error} />}

          {/* Simple device list */}
          <div className="space-y-2">
            <h4 className="font-medium">Devices ({state.devices.length})</h4>
            <div className="grid gap-2">
              {filteredDevices.map(device => (
                <div key={device.deviceid} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{device.devicename}</div>
                      <div className="text-sm text-muted-foreground">ID: {device.deviceid}</div>
                    </div>
                    <div className="text-sm">
                      Status: {device.isMoving ? 'Moving' : 'Parked'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51DeviceManager;
