
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bug, RefreshCw, Database, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';

interface DebugStats {
  totalVehicles: number;
  vehiclesWithGPS51Id: number;
  vehiclesWithPositions: number;
  totalPositions: number;
  latestPositionTime: string | null;
  oldestPositionTime: string | null;
}

interface SyncResult {
  success: boolean;
  statistics?: any;
  details?: any;
  error?: string;
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
      // Get vehicle statistics using current schema
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id');

      if (vehiclesError) throw vehiclesError;

      // Mock debug stats since position tables don't exist yet
      const debugStats: DebugStats = {
        totalVehicles: vehicles?.length || 0,
        vehiclesWithGPS51Id: 0, // No gps51_device_id column yet
        vehiclesWithPositions: 0, // No vehicle_positions table yet
        totalPositions: 0, // No vehicle_positions table yet
        latestPositionTime: null,
        oldestPositionTime: null
      };

      setStats(debugStats);
      
      toast({
        title: "Debug Stats Updated",
        description: `Found ${debugStats.totalVehicles} vehicles, ${debugStats.vehiclesWithPositions} with positions`,
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
      // Get GPS51 credentials from localStorage
      const apiUrl = localStorage.getItem('gps51_api_url');
      const username = localStorage.getItem('gps51_username');
      const password = localStorage.getItem('gps51_password_hash');

      if (!apiUrl || !username || !password) {
        throw new Error('GPS51 credentials not configured. Please configure them first.');
      }

      const { data, error } = await supabase.functions.invoke('gps51-sync', {
        body: {
          apiUrl,
          username,
          password
        }
      });

      if (error) throw error;

      setSyncResult(data);
      
      // Auto-refresh stats after sync
      setTimeout(fetchDebugStats, 1000);

      toast({
        title: "Test Sync Completed",
        description: `Synced ${data.statistics?.vehiclesSynced || 0} vehicles, ${data.statistics?.positionsStored || 0} positions`,
      });
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
            GPS51 Debug Panel
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Total Vehicles</div>
                <Badge variant="default" className="text-lg">
                  {stats.totalVehicles}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">With GPS51 ID</div>
                <Badge variant={getStatusColor(stats.vehiclesWithGPS51Id, stats.totalVehicles)} className="text-lg">
                  {stats.vehiclesWithGPS51Id}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">With Positions</div>
                <Badge variant={getStatusColor(stats.vehiclesWithPositions, stats.totalVehicles)} className="text-lg">
                  {stats.vehiclesWithPositions}
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
                <Badge variant={getStatusColor(stats.vehiclesWithPositions, stats.vehiclesWithGPS51Id)} className="text-lg">
                  {stats.vehiclesWithGPS51Id > 0 
                    ? Math.round((stats.vehiclesWithPositions / stats.vehiclesWithGPS51Id) * 100)
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
                      <div>Devices Found: <strong>{syncResult.statistics?.devicesFound || 0}</strong></div>
                      <div>Positions Retrieved: <strong>{syncResult.statistics?.positionsRetrieved || 0}</strong></div>
                      <div>Vehicles Synced: <strong>{syncResult.statistics?.vehiclesSynced || 0}</strong></div>
                      <div>Positions Stored: <strong>{syncResult.statistics?.positionsStored || 0}</strong></div>
                    </div>
                    
                    {syncResult.details && (
                      <div className="text-xs text-gray-600 mt-2">
                        Success Rates: Vehicle {syncResult.details.vehicleSyncSuccessRate}%, 
                        Position {syncResult.details.positionStorageSuccessRate}%
                      </div>
                    )}
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

          {stats && stats.vehiclesWithPositions === 0 && stats.vehiclesWithGPS51Id > 0 && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="space-y-2">
                    <div className="font-medium text-yellow-800">Position Data Issue Detected</div>
                    <div className="text-sm text-yellow-700">
                      You have {stats.vehiclesWithGPS51Id} vehicles with GPS51 device IDs but no position data. 
                      This suggests an issue with the position sync process.
                    </div>
                    <div className="text-xs text-yellow-600">
                      Try running a test sync to debug the issue.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
