
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Activity,
  Zap
} from 'lucide-react';

interface GPS51LiveDataStatusProps {
  isConnected: boolean;
  isPolling: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  onTogglePolling: () => void;
  metrics: {
    totalDevices: number;
    activeDevices: number;
    movingVehicles: number;
    offlineVehicles: number;
  };
}

export const GPS51LiveDataStatus: React.FC<GPS51LiveDataStatusProps> = ({
  isConnected,
  isPolling,
  lastSyncTime,
  error,
  loading,
  onRefresh,
  onTogglePolling,
  metrics
}) => {
  const getStatusIcon = () => {
    if (error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (isConnected && isPolling) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (isConnected) return <Wifi className="w-4 h-4 text-blue-500" />;
    return <WifiOff className="w-4 h-4 text-gray-400" />;
  };

  const getStatusBadge = () => {
    if (error) return <Badge variant="destructive">Error</Badge>;
    if (isConnected && isPolling) return <Badge className="bg-green-100 text-green-800">Live</Badge>;
    if (isConnected) return <Badge className="bg-blue-100 text-blue-800">Connected</Badge>;
    return <Badge variant="secondary">Disconnected</Badge>;
  };

  const formatLastUpdate = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastSyncTime.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return lastSyncTime.toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            GPS51 Live Data Status
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection:</span>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Real-time Updates:</span>
            <span className="text-sm">{isPolling ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Update:</span>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              {formatLastUpdate()}
            </div>
          </div>
        </div>

        {/* Fleet Overview */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-lg font-semibold">{metrics.totalDevices}</div>
              <div className="text-xs text-gray-500">Total Vehicles</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-lg font-semibold">{metrics.activeDevices}</div>
              <div className="text-xs text-gray-500">Active Now</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <div>
              <div className="text-lg font-semibold">{metrics.movingVehicles}</div>
              <div className="text-xs text-gray-500">Moving</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-red-500" />
            <div>
              <div className="text-lg font-semibold">{metrics.offlineVehicles}</div>
              <div className="text-xs text-gray-500">Offline</div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-800">Connection Error</span>
            </div>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 pt-2 border-t">
          <Button 
            onClick={onRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={onTogglePolling}
            variant={isPolling ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {isPolling ? <Zap className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {isPolling ? 'Live ON' : 'Live OFF'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
