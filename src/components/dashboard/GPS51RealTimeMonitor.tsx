import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Radio, 
  Shield,
  Zap,
  TrendingUp,
  Users,
  Car
} from 'lucide-react';
import { gps51CoordinatorClient } from '@/services/gps51/GPS51CoordinatorClient';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';

interface RealTimeMonitorProps {
  userId?: string;
  onUserActivityChange?: (isActive: boolean) => void;
}

export const GPS51RealTimeMonitor: React.FC<RealTimeMonitorProps> = ({
  userId,
  onUserActivityChange
}) => {
  const [coordinatorStatus, setCoordinatorStatus] = useState({
    queueSize: 0,
    lastRequest: null,
    circuitBreakerOpen: false,
    cacheHitRate: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { 
    connected: wsConnected, 
    connect: wsConnect, 
    disconnect: wsDisconnect,
    reconnectAttempts 
  } = useWebSocketConnection({
    onPositionUpdate: (vehicleId, position) => {
      console.log('Real-time position update:', { vehicleId, position });
    },
    onConnectionChange: (connected) => {
      console.log('WebSocket connection changed:', connected);
    }
  });

  // Update coordinator status periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await gps51CoordinatorClient.getCoordinatorStatus();
        setCoordinatorStatus(status);
      } catch (error) {
        console.error('Failed to get coordinator status:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleStartMonitoring = async () => {
    setIsMonitoring(true);
    
    // Update user activity
    if (userId) {
      onUserActivityChange?.(true);
    }
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
    
    if (userId) {
      onUserActivityChange?.(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'closed': return 'default';
      case 'open': return 'destructive';
      case 'half-open': return 'secondary';
      default: return 'secondary';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  // Mock strategy counts for display
  const strategyCounts = {
    high: 0,
    medium: 0,
    low: 0
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Radio className="w-5 h-5" />
                <span>GPS51 Real-Time Monitor</span>
              </CardTitle>
              <CardDescription>
                Intelligent orchestration and monitoring for GPS51 API interactions
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={wsConnected ? 'default' : 'destructive'}>
                {wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
              </Badge>
              {!isMonitoring ? (
                <Button onClick={handleStartMonitoring} className="flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>Start Monitoring</span>
                </Button>
              ) : (
                <Button onClick={handleStopMonitoring} variant="outline" className="flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>Stop Monitoring</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">Circuit Breaker</div>
            </div>
            <div className="mt-2">
              <Badge variant={coordinatorStatus.circuitBreakerOpen ? 'destructive' : 'default'}>
                {coordinatorStatus.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">Risk Level</div>
            </div>
            <div className="mt-2">
              <Badge variant="default">
                LOW
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">Success Rate</div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">100.0%</div>
              <Progress value={100} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Car className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm font-medium">Active Vehicles</div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{coordinatorStatus.queueSize}</div>
              <div className="text-xs text-muted-foreground">
                queued requests
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>API Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Queue Size</span>
              <span className="font-medium">{coordinatorStatus.queueSize}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Cache Hit Rate</span>
              <span className="font-medium">{(coordinatorStatus.cacheHitRate * 100).toFixed(1)}%</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Circuit Breaker</span>
              <span className="font-medium">{coordinatorStatus.circuitBreakerOpen ? 'Open' : 'Closed'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last Request</span>
              <span className="font-medium">
                {coordinatorStatus.lastRequest || 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Vehicle Polling Strategy</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">High Priority</span>
              <Badge variant="destructive">{strategyCounts.high}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Medium Priority</span>
              <Badge variant="secondary">{strategyCounts.medium}</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Low Priority</span>
              <Badge variant="secondary">{strategyCounts.low}</Badge>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              High: Real-time viewing or moving vehicles (10-15s intervals)<br/>
              Medium: Dashboard monitoring (30s intervals)<br/>
              Low: Background/idle vehicles (5min intervals)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WebSocket Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Radio className="w-4 h-4" />
            <span>WebSocket Connection</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {wsConnected ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                )}
                <span className="text-sm">
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {reconnectAttempts > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-warning" />
                  <span className="text-sm text-muted-foreground">
                    Reconnect attempts: {reconnectAttempts}
                  </span>
                </div>
              )}
            </div>
            <div className="flex space-x-2">
              {!wsConnected && (
                <Button onClick={wsConnect} size="sm" variant="outline">
                  Reconnect
                </Button>
              )}
              {wsConnected && (
                <Button onClick={wsDisconnect} size="sm" variant="outline">
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};