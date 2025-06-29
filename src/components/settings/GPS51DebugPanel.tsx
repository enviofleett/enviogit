
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GPS51SyncService } from '@/services/gps51/GPS51SyncService';
import { Bug, RefreshCw, Database, MapPin, AlertTriangle, CheckCircle, Users, Smartphone } from 'lucide-react';

interface DebugStats {
  totalUsers: number;
  totalDevices: number;
  devicesWithPositions: number;
  totalPositions: number;
  latestPositionTime: string | null;
  oldestPositionTime: string | null;
  activeDevices: number;
}

interface SyncResult {
  success: boolean;
  devicesProcessed?: number;
  positionsProcessed?: number;
  error?: string;
  duration?: number;
  timestamp: string;
}

export const GPS51DebugPanel = () => {
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const fetchDebugStats = async () => {
    setLoading(true);
    try {
      console.log('Fetching GPS51 debug stats from new database structure...');

      // Get user statistics
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, gps51_username');

      if (usersError) throw usersError;

      // Get device statistics
      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('id, device_id, device_name, last_seen_at');

      if (devicesError) throw devicesError;

      // Get position statistics
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('device_id, timestamp')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (positionsError) throw positionsError;

      // Get devices with positions
      const devicesWithPositions = new Set(positions?.map(p => p.device_id) || []);

      // Calculate active devices (seen in last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeDevices = devices?.filter(d => 
        d.last_seen_at && new Date(d.last_seen_at) > fiveMinutesAgo
      ).length || 0;

      const debugStats: DebugStats = {
        totalUsers: users?.length || 0,
        totalDevices: devices?.length || 0,
        devicesWithPositions: devicesWithPositions.size,
        totalPositions: positions?.length || 0,
        latestPositionTime: positions?.[0]?.timestamp || null,
        oldestPositionTime: positions?.[positions.length - 1]?.timestamp || null,
        activeDevices
      };

      setStats(debugStats);
      
      toast({
        title: "Debug Stats Updated",
        description: `Found ${debugStats.totalUsers} users, ${debugStats.totalDevices} devices, ${debugStats.devicesWithPositions} with positions`,
      });
    } catch (error) {
      console.error('Error fetching debug stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch debug statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerTestSync = async () => {
    setSyncing(true);
    try {
      console.log('Triggering GPS51 test sync...');
      
      const result = await GPS51SyncService.performScheduledSync();
      
      const syncResult: SyncResult = {
        success: result.success,
        devicesProcessed: result.devicesProcessed,
        positionsProcessed: result.positionsProcessed,
        error: result.error,
        duration: result.duration,
        timestamp: new Date().toISOString()
      };
      
      setSyncResult(syncResult);
      
      // Auto-refresh stats after sync
      setTimeout(fetchDebugStats, 1000);

      if (result.success) {
        toast({
          title: "Test Sync Completed",
          description: `Processed ${result.devicesProcessed} devices, ${result.positionsProcessed} positions in ${result.duration}ms`,
        });
      } else {
        toast({
          title: "Test Sync Failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Test sync error:', error);
      toast({
        title: "Test Sync Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (value: number, total: number) => {
    const ratio = total > 0 ? value / total : 0;
    if (ratio === 0) return 'destructive';
    if (ratio < 0.5) return 'outline';
    return 'default';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            GPS51 Debug Panel (New Database Structure)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={fetchDebugStats}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              {loading ? 'Loading...' : 'Refresh Stats'}
            </Button>
            
            <Button 
              onClick={triggerTestSync}
              disabled={syncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Test Sync'}
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  GPS51 Users
                </div>
                <Badge variant="default" className="text-lg">
                  {stats.totalUsers}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-1">
                  <Smartphone className="h-4 w-4" />
                  Total Devices
                </div>
                <Badge variant="default" className="text-lg">
                  {stats.totalDevices}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Active Devices
                </div>
                <Badge variant={getStatusColor(stats.activeDevices, stats.totalDevices)} className="text-lg">
                  {stats.activeDevices}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">With Positions</div>
                <Badge variant={getStatusColor(stats.devicesWithPositions, stats.totalDevices)} className="text-lg">
                  {stats.devicesWithPositions}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Total Positions</div>
                <Badge variant={stats.totalPositions > 0 ? 'default' : 'destructive'} className="text-lg">
                  {stats.totalPositions}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Latest Position</div>
                <div className="text-xs text-gray-600">
                  {stats.latestPositionTime 
                    ? new Date(stats.latestPositionTime).toLocaleString()
                    : 'No positions'
                  }
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Position Coverage</div>
                <Badge variant={getStatusColor(stats.devicesWithPositions, stats.totalDevices)} className="text-lg">
                  {stats.totalDevices > 0 
                    ? Math.round((stats.devicesWithPositions / stats.totalDevices) * 100)
                    : 0
                  }%
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Activity Rate</div>
                <Badge variant={getStatusColor(stats.activeDevices, stats.totalDevices)} className="text-lg">
                  {stats.totalDevices > 0 
                    ? Math.round((stats.activeDevices / stats.totalDevices) * 100)
                    : 0
                  }%
                </Badge>
              </div>
            </div>
          )}

          {syncResult && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {syncResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  Last Sync Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {syncResult.success ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Devices Processed: <strong>{syncResult.devicesProcessed || 0}</strong></div>
                      <div>Positions Processed: <strong>{syncResult.positionsProcessed || 0}</strong></div>
                      <div>Duration: <strong>{syncResult.duration || 0}ms</strong></div>
                      <div>Status: <strong className="text-green-600">Success</strong></div>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-600 text-sm">
                    Error: {syncResult.error}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(syncResult.timestamp).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          )}

          {stats && stats.devicesWithPositions === 0 && stats.totalDevices > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="space-y-2">
                    <div className="font-medium text-yellow-800">Position Data Issue Detected</div>
                    <div className="text-sm text-yellow-700">
                      You have {stats.totalDevices} devices but no position data in the new GPS51 positions table. 
                      This suggests the GPS51 sync process may not be working correctly.
                    </div>
                    <div className="text-xs text-yellow-600">
                      Try running a test sync to debug the issue, or check the GPS51 credentials and API connection.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-gray-500 border-t pt-2">
            <p>🔧 This debug panel now uses the new GPS51-specific database structure with dedicated users, devices, and positions tables.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
