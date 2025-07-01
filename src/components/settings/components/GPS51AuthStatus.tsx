
import React from 'react';
import { CheckCircle, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GPS51AuthStatusProps {
  status: {
    isAuthenticated: boolean;
    isConnected: boolean;
    isConfigured: boolean;
    connectionHealth: string;
    syncStatus: string;
    lastSync: Date | null;
    error: string | null;
  };
}

export const GPS51AuthStatus: React.FC<GPS51AuthStatusProps> = ({ status }) => {
  const getConnectionIcon = () => {
    if (status.isAuthenticated && status.connectionHealth === 'good') {
      return <Wifi className="h-5 w-5 text-green-600" />;
    } else if (status.isConnected) {
      return <Wifi className="h-5 w-5 text-yellow-600" />;
    } else {
      return <WifiOff className="h-5 w-5 text-red-600" />;
    }
  };

  const getStatusBadge = () => {
    if (status.isAuthenticated) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Connected</Badge>;
    } else if (status.isConfigured) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Configured</Badge>;
    } else {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800">Not Configured</Badge>;
    }
  };

  const getSyncStatusIcon = () => {
    switch (status.syncStatus) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getConnectionIcon()}
          GPS51 Connection Status
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Authentication:</span>
            <span className={`ml-2 ${status.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
              {status.isAuthenticated ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          <div>
            <span className="font-medium text-gray-700">Connection:</span>
            <span className={`ml-2 capitalize ${
              status.connectionHealth === 'good' ? 'text-green-600' : 
              status.connectionHealth === 'poor' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {status.connectionHealth}
            </span>
          </div>
          
          <div className="flex items-center">
            <span className="font-medium text-gray-700">Sync Status:</span>
            <span className="ml-2 flex items-center gap-1">
              {getSyncStatusIcon()}
              <span className="capitalize">{status.syncStatus}</span>
            </span>
          </div>
          
          <div>
            <span className="font-medium text-gray-700">Last Sync:</span>
            <span className="ml-2 text-gray-600">
              {status.lastSync ? status.lastSync.toLocaleString() : 'Never'}
            </span>
          </div>
        </div>

        {status.error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Connection Error</p>
                <p className="text-sm text-red-700 mt-1">{status.error}</p>
              </div>
            </div>
          </div>
        )}

        {status.isAuthenticated && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800">Successfully Connected</p>
                <p className="text-sm text-green-700 mt-1">
                  GPS51 API is authenticated and ready for data synchronization.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
