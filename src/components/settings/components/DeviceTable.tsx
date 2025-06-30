
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';
import { GPS51Device } from '@/services/gps51/GPS51Client';
import { DeviceStatusBadge } from './DeviceStatusBadge';

interface DeviceTableProps {
  devices: GPS51Device[];
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
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
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
          {loading ? (
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
                {devices.length === 0 ? 'No devices found' : 'No devices match your search'}
              </TableCell>
            </TableRow>
          ) : (
            filteredDevices.map((device) => (
              <TableRow key={device.deviceid}>
                <TableCell className="font-mono text-sm">{device.deviceid}</TableCell>
                <TableCell className="font-medium">{device.devicename}</TableCell>
                <TableCell>{device.devicetype}</TableCell>
                <TableCell className="font-mono text-sm">{device.simnum}</TableCell>
                <TableCell><DeviceStatusBadge device={device} /></TableCell>
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
  );
};
