
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GPS51Device } from '@/services/gps51/GPS51Client';

interface DeviceStatusBadgeProps {
  device: GPS51Device;
}

export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({ device }) => {
  if (device.status === 1) {
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  } else if (device.status === 0) {
    return <Badge variant="secondary">Inactive</Badge>;
  } else {
    return <Badge variant="outline">Unknown</Badge>;
  }
};
