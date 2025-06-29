
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useGPS51RealTimeSync } from '@/hooks/useGPS51RealTimeSync';

const RealTimeGPS51Status = () => {
  const { connect, disconnect, getState } = useGPS51RealTimeSync();
  const status = getState();

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const getStatusColor = () => {
    if (status.isConnected) return 'bg-green-500';
    if (status.error) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getStatusText = () => {
    if (status.isConnected) return 'Connected';
    if (status.error) return 'Error';
    return 'Disconnected';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          GPS51 Real-Time Status
        </CardTitle>
        <CardDescription>
          Connection status and real-time data streaming
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
          
          {status.lastUpdate && (
            <div className="flex items-center justify-between">
              <span>Last Update:</span>
              <span className="text-sm text-muted-foreground">
                {status.lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span>Vehicles:</span>
            <span className="font-medium">{status.vehicleCount}</span>
          </div>
          
          {status.error && (
            <div className="text-sm text-red-500 mt-2">
              Error: {status.error}
            </div>
          )}
          
          <div className="flex gap-2 mt-4">
            {status.isConnected ? (
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
              >
                Disconnect
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeGPS51Status;
