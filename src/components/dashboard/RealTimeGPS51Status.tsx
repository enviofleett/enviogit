import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';

interface RealTimeGPS51StatusProps {
  enabled: boolean;
  onToggle: () => void;
}

const RealTimeGPS51Status: React.FC<RealTimeGPS51StatusProps> = ({ enabled, onToggle }) => {
  const { vehicles, loading, error, refresh } = useGPS51Data();

  const getStatusIcon = () => {
    if (!enabled) return <WifiOff className="w-4 h-4 text-gray-400" />;
    if (error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (!loading) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Wifi className="w-4 h-4 text-blue-500" />;
  };

  const getStatusBadge = () => {
    if (!enabled) return <Badge variant="secondary">Disabled</Badge>;
    if (error) return <Badge variant="destructive">Error</Badge>;
    if (!loading && vehicles.length > 0) return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
    if (loading) return <Badge variant="outline">Loading...</Badge>;
    return <Badge variant="outline">No Data</Badge>;
  };

  const activeDevices = vehicles.filter(v => v.latest_position?.isMoving).length;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span>GPS51 Emergency Status</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Active Devices:</span>
            <p className="font-medium">{activeDevices}</p>
          </div>
          <div>
            <span className="text-slate-500">Total Vehicles:</span>
            <p className="font-medium">{vehicles.length}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Connection Error</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={!enabled || loading}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            {loading ? 'Loading...' : 'Refresh'}
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
                Enable
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-slate-500 border-t pt-2">
          {enabled ? (
            <p>🚨 Emergency mode: Rate-limited GPS51 integration with caching</p>
          ) : (
            <p>🔌 GPS51 integration disabled</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeGPS51Status;