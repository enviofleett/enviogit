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
import { gps51EmergencyManager } from '@/services/gps51/GPS51EmergencyManager';
import { useGPS51UnifiedData } from '@/hooks/useGPS51UnifiedData';

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
  
  const { state } = useGPS51UnifiedData();
  const vehicles = state.devices;
  const loading = state.isLoading;
  const error = state.error;

  // Get emergency status only once on mount (no polling to prevent API spikes)
  useEffect(() => {
    const getInitialStatus = async () => {
      try {
        // Use emergency manager diagnostics
        const diagnostics = gps51EmergencyManager.getDiagnostics();
        setCoordinatorStatus({
          queueSize: diagnostics.client.queueSize,
          lastRequest: null,
          circuitBreakerOpen: gps51EmergencyManager.isEmergencyStopActive(),
          cacheHitRate: 0
        });
      } catch (error) {
        console.error('Failed to get emergency status:', error);
      }
    };
    
    getInitialStatus();
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

  // Calculate active vehicles from positions data
  const activeVehicles = state.positions.filter(p => p.moving === 1).length;
  const successRate = error ? 0 : 100;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Radio className="w-5 h-5" />
                <span>GPS51 Emergency Monitor</span>
              </CardTitle>
              <CardDescription>
                Emergency GPS51 monitoring with rate limiting and caching
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={!error ? 'default' : 'destructive'}>
                {!error ? 'Connected' : 'Error'}
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
              <div className="text-sm font-medium">System Status</div>
            </div>
            <div className="mt-2">
              <Badge variant={error ? 'destructive' : 'default'}>
                {error ? 'ERROR' : 'OPERATIONAL'}
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
              <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
              <Progress value={successRate} className="mt-1" />
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
              <div className="text-2xl font-bold">{activeVehicles}</div>
              <div className="text-xs text-muted-foreground">
                of {vehicles.length} total
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
              <span>Emergency Mode Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rate Limiting</span>
              <Badge variant="default">ACTIVE</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Batch Requests</span>
              <Badge variant="default">ENABLED</Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Caching</span>
              <Badge variant="default">AGGRESSIVE</Badge>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              🚨 Emergency mode: 2s delays, 2min refresh intervals, batch processing
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>System Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};