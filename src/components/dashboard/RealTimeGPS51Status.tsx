import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';

interface RealTimeGPS51StatusProps {
  enabled: boolean;
  onToggle: () => void;
}

const RealTimeGPS51Status: React.FC<RealTimeGPS51StatusProps> = ({ enabled, onToggle }) => {
  const status = gps51ProductionService.getServiceStatus();
  const authState = gps51ProductionService.getAuthState();
  const loading = false;
  
  const refresh = () => {
    // Trigger refresh
    window.location.reload();
  };

  const getStatusIcon = () => {
    if (!enabled) return <WifiOff className="w-4 h-4 text-gray-400" />;
    if (authState.error) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (authState.isAuthenticated && status.deviceCount > 0) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (loading) return <Wifi className="w-4 h-4 text-blue-500" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusBadge = () => {
    if (!enabled) return <Badge variant="secondary">Disabled</Badge>;
    if (authState.error) return <Badge variant="destructive">Error</Badge>;
    if (!authState.isAuthenticated) return <Badge variant="outline">Not Configured</Badge>;
    if (authState.isAuthenticated && status.deviceCount > 0) return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
    if (loading) return <Badge variant="outline">Loading...</Badge>;
    return <Badge variant="outline">No Data</Badge>;
  };

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
            <span className="text-slate-500">Moving Vehicles:</span>
            <p className="font-medium">{status.movingVehicles}</p>
          </div>
          <div>
            <span className="text-slate-500">Total Devices:</span>
            <p className="font-medium">{status.deviceCount}</p>
          </div>
        </div>

        {authState.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Connection Error</p>
                <p className="text-xs text-red-600 mt-1">{authState.error}</p>
              </div>
            </div>
          </div>
        )}

        {!authState.isAuthenticated && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Configuration Required</p>
                <p className="text-xs text-yellow-600 mt-1">Please configure GPS51 credentials in Settings</p>
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
            authState.isAuthenticated ? (
              <p>✅ GPS51 unified service active ({authState.username})</p>
            ) : (
              <p>🚨 GPS51 enabled but not authenticated</p>
            )
          ) : (
            <p>🔌 GPS51 integration disabled</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeGPS51Status;