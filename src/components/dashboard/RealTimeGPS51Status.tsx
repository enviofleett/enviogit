
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useGPS51RealTimeSync } from '@/hooks/useGPS51RealTimeSync';

interface RealTimeGPS51StatusProps {
  enabled: boolean;
  onToggle: () => void;
}

const RealTimeGPS51Status: React.FC<RealTimeGPS51StatusProps> = ({ enabled, onToggle }) => {
  const { status, forceSync } = useGPS51RealTimeSync(enabled);

  const getStatusIcon = () => {
    if (!enabled) return <WifiOff className="w-4 h-4 text-gray-400" />;
    if (status.error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (status.isConnected) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Wifi className="w-4 h-4 text-blue-500" />;
  };

  const getStatusBadge = () => {
    if (!enabled) return <Badge variant="secondary">Disabled</Badge>;
    if (status.error) return <Badge variant="destructive">Error</Badge>;
    if (status.isConnected && status.isActive) return <Badge className="bg-green-100 text-green-800">Live</Badge>;
    if (status.isConnected) return <Badge className="bg-blue-100 text-blue-800">Connected</Badge>;
    return <Badge variant="outline">Connecting...</Badge>;
  };

  const formatLastUpdate = () => {
    if (!status.lastUpdate) return 'Never';
    const now = new Date();
    const diff = now.getTime() - status.lastUpdate.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return status.lastUpdate.toLocaleTimeString();
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>GPS51 Real-Time Status</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Active Devices:</span>
            <p className="font-medium">{status.activeDevices}</p>
          </div>
          <div>
            <span className="text-slate-500">Last Update:</span>
            <p className="font-medium">{formatLastUpdate()}</p>
          </div>
        </div>

        {status.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Connection Error</p>
                <p className="text-xs text-red-600 mt-1">{status.error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={forceSync}
            disabled={!enabled || !status.isConnected}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Force Sync
          </Button>
          
          <Button
            variant={enabled ? "destructive" : "default"}
            size="sm"
            onClick={onToggle}
          >
            {enabled ? (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                Disable
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Enable Live
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-slate-500 border-t pt-2">
          {enabled ? (
            <p>📡 Syncing with GPS51 every 30 seconds for real-time updates</p>
          ) : (
            <p>🔌 Real-time sync disabled. Enable to get live GPS51 data.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeGPS51Status;
