
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface DeviceErrorDisplayProps {
  error: string;
}

export const DeviceErrorDisplay: React.FC<DeviceErrorDisplayProps> = ({ error }) => {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start space-x-2">
        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      </div>
    </div>
  );
};
