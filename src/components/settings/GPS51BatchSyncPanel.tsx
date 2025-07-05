
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Clock, Users, Pause, Play, Settings } from 'lucide-react';

interface BatchSyncStats {
  priority1Count: number; // Active/Moving vehicles
  priority2Count: number; // Assigned vehicles
  priority3Count: number; // Available vehicles
  priority4Count: number; // Inactive vehicles
  totalVehicles: number;
  lastBatchSync: string | null;
  syncInProgress: boolean;
}

interface BatchSyncResult {
  success: boolean;
  priority: number;
  vehiclesProcessed: number;
  positionsStored: number;
  errors: number;
  duration: number;
  timestamp: string;
}

export const GPS51BatchSyncPanel = () => {
  const [stats, setStats] = useState<BatchSyncStats | null>(null);
  const [syncResults, setSyncResults] = useState<BatchSyncResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const { toast } = useToast();

  const fetchBatchStats = async () => {
    setLoading(true);
    try {
      console.log('Fetching batch sync statistics...');

      // Get vehicles categorized by priority
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          id, 
          status, 
          gps51_device_id,
          updated_at,
          vehicle_positions!left(
            timestamp, 
            ignition_status, 
            speed
          )
        `)
        .order('updated_at', { ascending: false });

      if (vehiclesError) throw vehiclesError;

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let priority1Count = 0; // Active/Moving vehicles
      let priority2Count = 0; // Assigned vehicles  
      let priority3Count = 0; // Available vehicles
      let priority4Count = 0; // Inactive vehicles

      vehicles?.forEach(vehicle => {
        const latestPosition = Array.isArray(vehicle.vehicle_positions) 
          ? vehicle.vehicle_positions.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0]
          : vehicle.vehicle_positions;

        const lastPositionTime = latestPosition ? new Date(latestPosition.timestamp) : null;
        const isRecentlyActive = lastPositionTime && lastPositionTime > oneHourAgo;
        const isMoving = latestPosition?.ignition_status || (latestPosition?.speed || 0) > 0;
        const hasRecentPosition = lastPositionTime && lastPositionTime > oneDayAgo;

        if (isRecentlyActive && isMoving) {
          priority1Count++; // Active/Moving
        } else if (vehicle.status === 'assigned' && hasRecentPosition) {
          priority2Count++; // Assigned with recent activity
        } else if (vehicle.status === 'available' && hasRecentPosition) {
          priority3Count++; // Available with recent activity
        } else {
          priority4Count++; // Inactive or no recent data
        }
      });

      const batchStats: BatchSyncStats = {
        priority1Count,
        priority2Count,
        priority3Count,
        priority4Count,
        totalVehicles: vehicles?.length || 0,
        lastBatchSync: null, // Will be implemented with actual batch sync
        syncInProgress: false
      };

      setStats(batchStats);
      
      toast({
        title: "Batch Stats Updated",
        description: `Categorized ${batchStats.totalVehicles} vehicles by priority`,
      });
    } catch (error) {
      console.error('Error fetching batch stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch batch statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerBatchSync = async (priority: number) => {
    setBatchSyncing(true);
    const startTime = Date.now();
    
    try {
      console.log(`Starting batch sync for priority ${priority}...`);

      // Get GPS51 credentials
      const apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const password = localStorage.getItem('gps51_password_hash');

      if (!apiUrl || !username || !password) {
        throw new Error('GPS51 credentials not configured');
      }

      // Call the enhanced sync function with priority parameter
      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          apiUrl,
          username,
          password,
          priority,
          batchMode: true
        }
      });

      if (error) throw error;

      const duration = Date.now() - startTime;
      const result: BatchSyncResult = {
        success: data.success,
        priority,
        vehiclesProcessed: data.statistics?.vehiclesSynced || 0,
        positionsStored: data.statistics?.positionsStored || 0,
        errors: data.statistics?.vehicleSyncErrors || 0,
        duration: Math.round(duration / 1000),
        timestamp: new Date().toISOString()
      };

      setSyncResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      
      // Refresh stats after sync
      setTimeout(fetchBatchStats, 1000);

      toast({
        title: `Priority ${priority} Sync Completed`,
        description: `Processed ${result.vehiclesProcessed} vehicles, stored ${result.positionsStored} positions`,
      });
    } catch (error) {
      console.error(`Priority ${priority} batch sync error:`, error);
      
      const result: BatchSyncResult = {
        success: false,
        priority,
        vehiclesProcessed: 0,
        positionsStored: 0,
        errors: 1,
        duration: Math.round((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      };

      setSyncResults(prev => [result, ...prev.slice(0, 9)]);

      toast({
        title: `Priority ${priority} Sync Failed`,
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setBatchSyncing(false);
    }
  };

  const getPriorityConfig = (priority: number) => {
    const configs = {
      1: { name: 'Active/Moving', interval: '30 seconds', color: 'destructive', icon: Zap },
      2: { name: 'Assigned', interval: '2 minutes', color: 'default', icon: Users },
      3: { name: 'Available', interval: '5 minutes', color: 'secondary', icon: Clock },
      4: { name: 'Inactive', interval: '15 minutes', color: 'outline', icon: Pause }
    };
    return configs[priority as keyof typeof configs];
  };

  const getPriorityCount = (priority: number) => {
    if (!stats) return 0;
    const counts = {
      1: stats.priority1Count,
      2: stats.priority2Count,
      3: stats.priority3Count,
      4: stats.priority4Count
    };
    return counts[priority as keyof typeof counts];
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Smart Batch Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={fetchBatchStats}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {loading ? 'Loading...' : 'Refresh Stats'}
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(priority => {
                const config = getPriorityConfig(priority);
                const count = getPriorityCount(priority);
                const Icon = config.icon;
                
                return (
                  <Card key={priority} className="border-2">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className="h-5 w-5 text-gray-600" />
                        <Badge variant={config.color as any}>
                          Priority {priority}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{config.name}</div>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-gray-500">
                          Sync every {config.interval}
                        </div>
                      </div>
                      
                      <Button
                        onClick={() => triggerBatchSync(priority)}
                        disabled={batchSyncing}
                        size="sm"
                        className="w-full mt-3"
                        variant={priority === 1 ? 'default' : 'outline'}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {batchSyncing ? 'Syncing...' : 'Sync Now'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {syncResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Batch Sync Results</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {syncResults.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            P{result.priority}
                          </Badge>
                          <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                            {result.success ? '✓' : '✗'}
                          </span>
                          <span>
                            {result.vehiclesProcessed} vehicles, {result.positionsStored} positions
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.duration}s • {new Date(result.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
