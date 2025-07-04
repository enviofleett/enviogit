
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, MapPin, Clock } from 'lucide-react';
import { GPS51Device } from '@/services/gps51/GPS51Client';
import { GPS51Position } from '@/services/gps51/types';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { GPS51TimestampUtils } from '@/services/gps51/GPS51TimestampUtils';

interface EnhancedDeviceData extends GPS51Device {
  lastPosition?: GPS51Position;
}

interface DeviceTableProps {
  devices: EnhancedDeviceData[];
  loading: boolean;
  searchTerm: string;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({ devices, loading, searchTerm }) => {
  const filteredDevices = devices.filter(device => 
    device.devicename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.deviceid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.devicetype.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatLastActiveTime = (timestamp: number) => {
    return GPS51TimestampUtils.formatRelativeTime(timestamp);
  };

  const formatLocation = (lat?: number, lon?: number) => {
    if (!lat || !lon) return '-';
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  const formatLocationTime = (timestamp?: number) => {
    return GPS51TimestampUtils.formatLocationTime(timestamp);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device ID</TableHead>
            <TableHead>Device Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Login Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead>Last Location</TableHead>
            <TableHead>Location Time</TableHead>
            <TableHead>SIM Number</TableHead>
            <TableHead>Remark</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8">
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Loading devices...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : filteredDevices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                {devices.length === 0 ? 'No devices found' : 'No devices match your search'}
              </TableCell>
            </TableRow>
          ) : (
            filteredDevices.map((device) => (
              <TableRow key={device.deviceid}>
                <TableCell className="font-mono text-sm">{device.deviceid}</TableCell>
                <TableCell className="font-medium">{device.devicename}</TableCell>
                <TableCell>{device.devicetype}</TableCell>
                <TableCell className="text-sm">
                  {device.creater || '-'}
                </TableCell>
                <TableCell className="text-sm">
                  {device.loginame || '-'}
                </TableCell>
                <TableCell><DeviceStatusBadge device={device} /></TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatLastActiveTime(device.lastactivetime)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span>{formatLocation(device.lastPosition?.callat || device.callat, device.lastPosition?.callon || device.callon)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {formatLocationTime(device.lastPosition?.updatetime || device.updatetime)}
                </TableCell>
                <TableCell className="font-mono text-sm">{device.simnum}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {device.remark || '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
