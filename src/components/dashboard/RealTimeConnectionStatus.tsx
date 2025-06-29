
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Zap, RefreshCw } from 'lucide-react';

interface RealTimeConnectionStatusProps {
  connected: boolean;
  lastUpdateTime: Date | null;
  reconnectAttempts?: number;
  onRefresh?: () => void;
  onToggleRealTime?: () => void;
  vehicleCount?: number;
}

const RealTimeConnectionStatus: React.FC<RealTimeConnectionStatusProps> = ({
  connected,
  lastUpdateTime,
  reconnectAttempts = 0,
  onRefresh,
  onToggleRealTime,
  vehicleCount = 0
}) => {
  const getTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffSecs < 30) {
      return 'Just now';
    } else if (diffSecs < 60) {
      return `${diffSecs}s ago`;
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          {connected ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <div className="flex items-center space-x-2">
            <Badge 
              className={connected 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
              }
            >
              {connected ? 'Real-time Active' : 'Offline Mode'}
            </Badge>
            {connected && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-slate-600">Live</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-sm text-slate-600">
          <div className="flex items-center space-x-4">
            <span>
              Last update: {getTimeAgo(lastUpdateTime)}
            </span>
            {vehicleCount > 0 && (
              <span className="flex items-center space-x-1">
                <Zap className="w-3 h-3" />
                <span>{vehicleCount} vehicles tracked</span>
              </span>
            )}
          </div>
          {reconnectAttempts > 0 && (
            <div className="text-xs text-orange-600 mt-1">
              Reconnecting... (attempt {reconnectAttempts})
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {onRefresh && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            className="h-8"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        )}
        
        {onToggleRealTime && (
          <Button
            size="sm"
            variant={connected ? "destructive" : "default"}
            onClick={onToggleRealTime}
            className="h-8"
          >
            {connected ? (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                Disable Real-time
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Enable Real-time
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default RealTimeConnectionStatus;
