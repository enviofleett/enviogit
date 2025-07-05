import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  Clock, 
  WifiOff, 
  BarChart3, 
  RefreshCw,
  MapPin,
  Battery,
  Signal
} from 'lucide-react';

interface OfflineDevice {
  deviceId: string;
  deviceName: string;
  lastActiveTime: number;
  daysSinceActive: number;
  category: 'recently_offline' | 'medium_offline' | 'long_offline' | 'critical_offline';
  simStatus?: string;
  batteryLevel?: number;
  signalStrength?: number;
}

interface DiagnosticStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  recentlyOffline: number; // < 24 hours
  mediumOffline: number; // 1-7 days
  longOffline: number; // 7-30 days
  criticalOffline: number; // > 30 days
}

export const GPS51OfflineDeviceDiagnostics = () => {
  const [stats, setStats] = useState<DiagnosticStats | null>(null);
  const [offlineDevices, setOfflineDevices] = useState<OfflineDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();

  const categorizeDevice = (lastActiveTime: number): OfflineDevice['category'] => {
    const now = Date.now();
    const daysSince = (now - lastActiveTime) / (1000 * 60 * 60 * 24);
    
    if (daysSince < 1) return 'recently_offline';
    if (daysSince < 7) return 'medium_offline';
    if (daysSince < 30) return 'long_offline';
    return 'critical_offline';
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      console.log('🔍 Starting offline device diagnostics...');
      
      // Call the GPS51 sync function to get latest device data
      const { data: syncResponse, error: syncError } = await supabase.functions.invoke('gps51-sync', {
        body: {
          priority: 0, // Get all devices
          batchMode: false,
          diagnosticMode: true
        }
      });

      if (syncError) {
        console.error('Sync error:', syncError);
        throw new Error('Failed to fetch device data');
      }

      console.log('📡 Sync response:', syncResponse);

      // Get vehicles from database with GPS51 device IDs
      const { data: vehicles, error: vehicleError } = await supabase
        .from('vehicles')
        .select(`
          gps51_device_id,
          license_plate,
          status,
          updated_at,
          vehicle_positions!left(
            timestamp,
            ignition_status,
            speed
          )
        `)
        .not('gps51_device_id', 'is', null);

      if (vehicleError) {
        console.error('Vehicle query error:', vehicleError);
        throw new Error('Failed to fetch vehicle data');
      }

      console.log('🚗 Found vehicles:', vehicles?.length || 0);

      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      
      let totalDevices = vehicles?.length || 0;
      let onlineDevices = 0;
      const offlineDevicesList: OfflineDevice[] = [];

      vehicles?.forEach(vehicle => {
        if (!vehicle.gps51_device_id) return;

        // Get latest position
        const latestPosition = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0]
          : vehicle.vehicle_positions;

        const lastActiveTime = latestPosition 
          ? new Date(latestPosition.timestamp).getTime()
          : new Date(vehicle.updated_at).getTime();

        const isOnline = lastActiveTime > thirtyMinutesAgo;

        if (isOnline) {
          onlineDevices++;
        } else {
          const daysSinceActive = (now - lastActiveTime) / (1000 * 60 * 60 * 24);
          offlineDevicesList.push({
            deviceId: vehicle.gps51_device_id,
            deviceName: vehicle.license_plate || vehicle.gps51_device_id,
            lastActiveTime,
            daysSinceActive,
            category: categorizeDevice(lastActiveTime),
            batteryLevel: undefined, // Will be enhanced with actual battery data later
            signalStrength: latestPosition?.speed ? 100 : 0 // Simplified signal strength
          });
        }
      });

      // Calculate category counts
      const recentlyOffline = offlineDevicesList.filter(d => d.category === 'recently_offline').length;
      const mediumOffline = offlineDevicesList.filter(d => d.category === 'medium_offline').length;
      const longOffline = offlineDevicesList.filter(d => d.category === 'long_offline').length;
      const criticalOffline = offlineDevicesList.filter(d => d.category === 'critical_offline').length;

      const diagnosticStats: DiagnosticStats = {
        totalDevices,
        onlineDevices,
        offlineDevices: offlineDevicesList.length,
        recentlyOffline,
        mediumOffline,
        longOffline,
        criticalOffline
      };

      setStats(diagnosticStats);
      setOfflineDevices(offlineDevicesList);

      console.log('📊 Diagnostic complete:', diagnosticStats);

      toast({
        title: "Diagnostics Complete",
        description: `Found ${offlineDevicesList.length} offline devices out of ${totalDevices} total`,
      });

    } catch (error) {
      console.error('Diagnostics error:', error);
      toast({
        title: "Diagnostics Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBadge = (category: OfflineDevice['category']) => {
    switch (category) {
      case 'recently_offline':
        return <Badge variant="secondary">Recently Offline (&lt;24h)</Badge>;
      case 'medium_offline':
        return <Badge variant="outline">Medium Term (1-7d)</Badge>;
      case 'long_offline':
        return <Badge variant="destructive">Long Term (7-30d)</Badge>;
      case 'critical_offline':
        return <Badge className="bg-red-600 text-white">Critical (&gt;30d)</Badge>;
    }
  };

  const getFilteredDevices = () => {
    if (selectedCategory === 'all') return offlineDevices;
    return offlineDevices.filter(device => device.category === selectedCategory);
  };

  const generateRecommendations = () => {
    if (!stats) return [];

    const recommendations = [];

    if (stats.recentlyOffline > 0) {
      recommendations.push({
        priority: 'high',
        action: `Check ${stats.recentlyOffline} recently offline devices - likely temporary connectivity issues`,
        devices: stats.recentlyOffline
      });
    }

    if (stats.mediumOffline > 0) {
      recommendations.push({
        priority: 'medium',
        action: `Investigate ${stats.mediumOffline} medium-term offline devices - possible SIM or power issues`,
        devices: stats.mediumOffline
      });
    }

    if (stats.longOffline > 0) {
      recommendations.push({
        priority: 'medium',
        action: `Review ${stats.longOffline} long-term offline devices - may need field service`,
        devices: stats.longOffline
      });
    }

    if (stats.criticalOffline > 0) {
      recommendations.push({
        priority: 'low',
        action: `Audit ${stats.criticalOffline} critical offline devices - consider replacement or removal`,
        devices: stats.criticalOffline
      });
    }

    return recommendations;
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          GPS51 Offline Device Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
          </Button>
        </div>

        {stats && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{stats.totalDevices}</div>
                <div className="text-sm text-muted-foreground">Total Devices</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{stats.onlineDevices}</div>
                <div className="text-sm text-green-600">Online</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{stats.offlineDevices}</div>
                <div className="text-sm text-red-600">Offline</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round((stats.onlineDevices / stats.totalDevices) * 100)}%
                </div>
                <div className="text-sm text-blue-600">Online Rate</div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg text-center">
                <div className="text-lg font-semibold">{stats.recentlyOffline}</div>
                <div className="text-xs text-muted-foreground">Recently Offline</div>
                <div className="text-xs text-muted-foreground">&lt;24 hours</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-lg font-semibold">{stats.mediumOffline}</div>
                <div className="text-xs text-muted-foreground">Medium Term</div>
                <div className="text-xs text-muted-foreground">1-7 days</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-lg font-semibold">{stats.longOffline}</div>
                <div className="text-xs text-muted-foreground">Long Term</div>
                <div className="text-xs text-muted-foreground">7-30 days</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-lg font-semibold">{stats.criticalOffline}</div>
                <div className="text-xs text-muted-foreground">Critical</div>
                <div className="text-xs text-muted-foreground">&gt;30 days</div>
              </div>
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList>
                <TabsTrigger value="all">All Offline ({stats.offlineDevices})</TabsTrigger>
                <TabsTrigger value="recently_offline">Recent ({stats.recentlyOffline})</TabsTrigger>
                <TabsTrigger value="medium_offline">Medium ({stats.mediumOffline})</TabsTrigger>
                <TabsTrigger value="long_offline">Long ({stats.longOffline})</TabsTrigger>
                <TabsTrigger value="critical_offline">Critical ({stats.criticalOffline})</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedCategory} className="space-y-4">
                <ScrollArea className="h-64 w-full border rounded p-4">
                  <div className="space-y-2">
                    {getFilteredDevices().map((device, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <WifiOff className="h-4 w-4 text-red-500" />
                          <div>
                            <div className="font-medium">{device.deviceName}</div>
                            <div className="text-sm text-muted-foreground">
                              ID: {device.deviceId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Last active: {Math.round(device.daysSinceActive)} days ago
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          {getCategoryBadge(device.category)}
                          {device.batteryLevel && (
                            <div className="flex items-center gap-1 text-xs">
                              <Battery className="h-3 w-3" />
                              {device.batteryLevel}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="font-medium">Recommended Actions</h4>
              {generateRecommendations().map((rec, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                      {rec.priority.toUpperCase()}
                    </Badge>
                    <span className="text-sm">{rec.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};