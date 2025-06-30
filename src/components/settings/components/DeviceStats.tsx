
import React from 'react';
import { GPS51Device } from '@/services/gps51/GPS51Client';

interface DeviceStatsProps {
  devices: GPS51Device[];
  filteredDevices: GPS51Device[];
}

export const DeviceStats: React.FC<DeviceStatsProps> = ({ devices, filteredDevices }) => {
  if (filteredDevices.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {filteredDevices.length} of {devices.length} devices
      </span>
      <div className="flex items-center space-x-4">
        <span>Active: {devices.filter(d => d.status === 1).length}</span>
        <span>Inactive: {devices.filter(d => d.status === 0).length}</span>
      </div>
    </div>
  );
};
