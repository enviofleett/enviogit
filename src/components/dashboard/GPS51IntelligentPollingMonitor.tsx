import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Activity, Car, Clock, BarChart3, RefreshCw, Settings } from 'lucide-react';
import { gps51IntelligentPolling, VehicleState } from '@/services/gps51/GPS51IntelligentPolling';
import { gps51ProductionService } from '@/services/gps51/GPS51ProductionService';

export const GPS51IntelligentPollingMonitor: React.FC = () => {
  const [pollingStats, setPollingStats] = useState({
    totalVehicles: 0,
    byState: {} as Record<VehicleState, number>,
    averageInterval: 0,
    readyForPolling: 0
  });

  const [serviceStatus, setServiceStatus] = useState<any>(null);

  useEffect(() => {
    const updateStats = () => {
      const stats = gps51IntelligentPolling.getPollingStatistics();
      const status = gps51ProductionService.getServiceStatus();
      
      setPollingStats(stats);
      setServiceStatus(status);
    };

    updateStats();
    const interval = setInterval(updateStats, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatInterval = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const getStateColor = (state: VehicleState): string => {
    switch (state) {
      case VehicleState.MOVING: return 'text-green-600';
      case VehicleState.IDLING: return 'text-yellow-600';
      case VehicleState.PARKED: return 'text-blue-600';
      case VehicleState.OFFLINE: return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStateBadgeVariant = (state: VehicleState) => {
    switch (state) {
      case VehicleState.MOVING: return 'default';
      case VehicleState.IDLING: return 'secondary';
      case VehicleState.PARKED: return 'outline';
      case VehicleState.OFFLINE: return 'destructive';
      default: return 'outline';
    }
  };

  const handleRefreshStates = async () => {
    await gps51ProductionService.refreshAllVehicleStates();
  };

  const globalPollingInterval = gps51IntelligentPolling.calculateGlobalPollingInterval();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Intelligent Polling Monitor
          <Badge variant="outline" className="ml-auto">
            Phase 5
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Polling Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Global Interval</span>
            </div>
            <div className="text-2xl font-bold">
              {formatInterval(globalPollingInterval)}
            </div>
            <div className="text-xs text-muted-foreground">
              Adaptive based on vehicle states
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span className="text-sm font-medium">Ready to Poll</span>
            </div>
            <div className="text-2xl font-bold">
              {pollingStats.readyForPolling}
            </div>
            <div className="text-xs text-muted-foreground">
              of {pollingStats.totalVehicles} vehicles
            </div>
          </div>
        </div>

        {/* Vehicle States Distribution */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Vehicle States</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(pollingStats.byState).map(([state, count]) => (
              <div key={state} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <Badge variant={getStateBadgeVariant(state as VehicleState)} className="text-xs">
                    {state}
                  </Badge>
                </div>
                <span className={`font-semibold ${getStateColor(state as VehicleState)}`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Polling Efficiency */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Polling Efficiency</h4>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Average Interval</span>
              <span>{formatInterval(pollingStats.averageInterval)}</span>
            </div>
            <Progress 
              value={Math.min((pollingStats.averageInterval / 300000) * 100, 100)} 
              className="h-2" 
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Polling Load</span>
              <span>{Math.round((pollingStats.readyForPolling / Math.max(pollingStats.totalVehicles, 1)) * 100)}%</span>
            </div>
            <Progress 
              value={(pollingStats.readyForPolling / Math.max(pollingStats.totalVehicles, 1)) * 100} 
              className="h-2" 
            />
          </div>
        </div>

        {/* Service Integration Status */}
        {serviceStatus && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Service Integration</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold">{serviceStatus.deviceCount}</div>
                <div className="text-xs text-muted-foreground">Total Devices</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{serviceStatus.movingVehicles}</div>
                <div className="text-xs text-muted-foreground">Moving</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{serviceStatus.offlineVehicles}</div>
                <div className="text-xs text-muted-foreground">Offline</div>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Insights */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Smart Insights</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            {pollingStats.byState[VehicleState.MOVING] > 0 && (
              <div className="text-green-600">✅ High-priority polling active for moving vehicles</div>
            )}
            {pollingStats.byState[VehicleState.OFFLINE] > pollingStats.totalVehicles * 0.5 && (
              <div className="text-yellow-600">⚠️ Many offline vehicles - consider longer intervals</div>
            )}
            {pollingStats.readyForPolling === 0 && (
              <div className="text-blue-600">💤 All vehicles on optimal polling schedule</div>
            )}
            {pollingStats.averageInterval < 60000 && (
              <div className="text-orange-600">🔥 High-frequency polling - monitor API usage</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshStates}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh States
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Settings className="h-3 w-3" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};