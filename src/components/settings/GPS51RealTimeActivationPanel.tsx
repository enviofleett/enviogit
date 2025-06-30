
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Square, 
  Wifi, 
  WifiOff, 
  Activity, 
  Users, 
  Clock,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { gps51RealTimeActivationService } from '@/services/gps51/GPS51RealTimeActivationService';

export const GPS51RealTimeActivationPanel = () => {
  const [activationStatus, setActivationStatus] = useState({
    isActive: false,
    stats: {
      totalVehicles: 0,
      activePolling: false,
      webSocketConnected: false,
      lastActivation: null as Date | null,
      pollingInterval: 30000,
      priority1Vehicles: 0,
      priority2Vehicles: 0,
      priority3Vehicles: 0,
      priority4Vehicles: 0
    }
  });
  
  const [systemHealth, setSystemHealth] = useState({
    polling: false,
    webSocket: false,
    lastUpdate: null as Date | null,
    vehicleCount: 0,
    positionCount: 0
  });
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      const status = gps51RealTimeActivationService.getActivationStatus();
      const health = await gps51RealTimeActivationService.getSystemHealth();
      
      setActivationStatus(status);
      setSystemHealth(health);
    } catch (error) {
      console.error('Error fetching activation status:', error);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      console.log('🚀 Activating real-time GPS51 system...');
      
      const result = await gps51RealTimeActivationService.activateRealTimeSystem();
      
      if (result.success) {
        toast({
          title: "Real-Time System Activated! 🚀",
          description: result.message,
        });
        
        setActivationStatus({
          isActive: true,
          stats: result.stats
        });
      } else {
        toast({
          title: "Activation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Activation error:', error);
      toast({
        title: "Activation Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      fetchStatus();
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      console.log('🛑 Deactivating real-time GPS51 system...');
      
      const result = await gps51RealTimeActivationService.deactivateRealTimeSystem();
      
      if (result.success) {
        toast({
          title: "Real-Time System Deactivated",
          description: result.message,
        });
        
        setActivationStatus(prev => ({
          ...prev,
          isActive: false
        }));
      } else {
        toast({
          title: "Deactivation Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      toast({
        title: "Deactivation Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      fetchStatus();
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    if (activationStatus.isActive && activationStatus.stats.activePolling) {
      return <Badge className="bg-green-100 text-green-800">Live & Active</Badge>;
    } else if (activationStatus.isActive) {
      return <Badge className="bg-blue-100 text-blue-800">Activated</Badge>;
    } else {
      return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              GPS51 Real-Time System Control
            </div>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Vehicles</p>
                <p className="text-2xl font-bold">{activationStatus.stats.totalVehicles.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Clock className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Polling Interval</p>
                <p className="text-2xl font-bold">{activationStatus.stats.pollingInterval / 1000}s</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              {activationStatus.stats.activePolling ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-sm text-slate-600">Active Polling</p>
                <p className="text-lg font-bold">
                  {activationStatus.stats.activePolling ? 'Running' : 'Stopped'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              {activationStatus.stats.webSocketConnected ? (
                <Wifi className="h-8 w-8 text-green-600" />
              ) : (
                <WifiOff className="h-8 w-8 text-red-600" />
              )}
              <div>
                <p className="text-sm text-slate-600">WebSocket</p>
                <p className="text-lg font-bold">
                  {activationStatus.stats.webSocketConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">Priority Distribution</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium">Priority 1</span>
                </div>
                <p className="text-lg font-bold mt-1">{activationStatus.stats.priority1Vehicles}</p>
                <p className="text-xs text-slate-500">30s updates</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm font-medium">Priority 2</span>
                </div>
                <p className="text-lg font-bold mt-1">{activationStatus.stats.priority2Vehicles}</p>
                <p className="text-xs text-slate-500">2m updates</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm font-medium">Priority 3</span>
                </div>
                <p className="text-lg font-bold mt-1">{activationStatus.stats.priority3Vehicles}</p>
                <p className="text-xs text-slate-500">5m updates</p>
              </div>
              
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Priority 4</span>
                </div>
                <p className="text-lg font-bold mt-1">{activationStatus.stats.priority4Vehicles}</p>
                <p className="text-xs text-slate-500">15m updates</p>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">System Health</h4>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Live Vehicles:</span>
                  <p className="font-medium">{systemHealth.vehicleCount}</p>
                </div>
                <div>
                  <span className="text-slate-600">Live Positions:</span>
                  <p className="font-medium">{systemHealth.positionCount}</p>
                </div>
                <div>
                  <span className="text-slate-600">Last Update:</span>
                  <p className="font-medium">{formatLastUpdate(systemHealth.lastUpdate)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t">
            {!activationStatus.isActive ? (
              <Button
                onClick={handleActivate}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                {loading ? 'Activating...' : 'Activate Real-Time System'}
              </Button>
            ) : (
              <Button
                onClick={handleDeactivate}
                disabled={loading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                {loading ? 'Deactivating...' : 'Deactivate System'}
              </Button>
            )}
            
            <Button
              onClick={fetchStatus}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>

          {/* Activation Info */}
          {activationStatus.stats.lastActivation && (
            <div className="text-sm text-slate-600 border-t pt-4">
              <p>
                <strong>Last Activation:</strong> {activationStatus.stats.lastActivation.toLocaleString()}
              </p>
              <p className="mt-1">
                📡 Real-time GPS51 system is actively polling {activationStatus.stats.totalVehicles.toLocaleString()} vehicles 
                with WebSocket updates enabled for immediate position changes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
