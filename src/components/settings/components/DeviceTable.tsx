
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, MapPin, Clock } from 'lucide-react';
import { GPS51Device } from '@/services/gps51/GPS51Client';
import { GPS51Position } from '@/services/gps51/types';
import { DeviceStatusBadge } from './DeviceStatusBadge';

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

  // Helper function to validate and normalize timestamps (same logic as GPS51LiveDataEnhancer)
  const validateAndNormalizeTimestamp = (timestamp: number): number => {
    if (timestamp === 0) return 0;
    
    // If timestamp is in seconds (roughly before year 2100), convert to milliseconds
    if (timestamp < 4000000000) {
      return timestamp * 1000;
    }
    
    // Already in milliseconds
    return timestamp;
  };

  const formatLastActiveTime = (timestamp: number) => {
    if (!timestamp) return 'Never';
    
    const normalizedTimestamp = validateAndNormalizeTimestamp(timestamp);
    const now = Date.now();
    const diffMs = now - normalizedTimestamp;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    // Enhanced relative time formatting
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show formatted date with time
    const date = new Date(normalizedTimestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it's today or yesterday
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // For older dates, show full date and time
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatLocation = (lat?: number, lon?: number) => {
    if (!lat || !lon) return '-';
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  const formatLocationTime = (timestamp?: number) => {
    if (!timestamp) return '-';
    const normalizedTimestamp = validateAndNormalizeTimestamp(timestamp);
    const date = new Date(normalizedTimestamp);
    const now = Date.now();
    const diffMs = now - normalizedTimestamp;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    
    // Show relative time for recent updates
    if (diffMinutes < 60) {
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
    }
    
    // Show time for today, date + time for older
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
