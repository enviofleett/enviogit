
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor } from 'lucide-react';
import { gps51Client, GPS51Device } from '@/services/gps51/GPS51Client';
import { GPS51Position } from '@/services/gps51/types';
import { useToast } from '@/hooks/use-toast';
import { DeviceSearchControls } from './components/DeviceSearchControls';
import { DeviceTable } from './components/DeviceTable';
import { DeviceStats } from './components/DeviceStats';
import { DeviceErrorDisplay } from './components/DeviceErrorDisplay';

interface EnhancedDeviceData extends GPS51Device {
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
    if (!gps51Client.isAuthenticated()) {
      setState(prev => ({ 
        ...prev, 
        error: 'Not authenticated. Please configure GPS51 credentials first.' 
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      console.log('Fetching GPS51 device list and recent positions...');
      const devices = await gps51Client.getDeviceList();
      
      // Fetch recent positions for devices that have location data
      const deviceIds = devices.filter(d => d.callat && d.callon).map(d => d.deviceid);
      let enhancedDevices: EnhancedDeviceData[] = devices;
      
      if (deviceIds.length > 0) {
        try {
          // Fetch recent positions (last 24 hours) for devices with location data
          const oneHourAgo = Math.floor((Date.now() - (60 * 60 * 1000)) / 1000);
          const recentPositions = await gps51Client.getRealtimePositions(deviceIds, oneHourAgo);
          
          // Create a map of device ID to most recent position
          const positionMap = new Map<string, GPS51Position>();
          recentPositions.positions.forEach(pos => {
            const existing = positionMap.get(pos.deviceid);
            if (!existing || pos.updatetime > existing.updatetime) {
              positionMap.set(pos.deviceid, pos);
            }
          });
          
          // Enhance devices with position data
          enhancedDevices = devices.map(device => ({
            ...device,
            lastPosition: positionMap.get(device.deviceid)
          }));
          
          console.log('Enhanced devices with position data:', {
            devicesWithPositions: positionMap.size,
            totalDevices: devices.length
          });
        } catch (positionError) {
          console.warn('Failed to fetch recent positions, continuing with device data only:', positionError);
        }
      }
      
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
            isAuthenticated={gps51Client.isAuthenticated()}
            lastSync={state.lastSync}
          />

          {state.error && <DeviceErrorDisplay error={state.error} />}

          <DeviceTable
            devices={state.devices}
            loading={state.loading}
            searchTerm={state.searchTerm}
          />

          <DeviceStats
            devices={state.devices}
            filteredDevices={filteredDevices}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default GPS51DeviceManager;
