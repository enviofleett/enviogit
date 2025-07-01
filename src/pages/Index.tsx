
import { useEffect, useState } from 'react';
import GPS51LiveDashboard from '@/components/dashboard/GPS51LiveDashboard';
import GPS51AntiOverloadDashboard from '@/components/dashboard/GPS51AntiOverloadDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Wifi, Users, MapPin, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [systemStats, setSystemStats] = useState({
    totalVehicles: 0,
    totalPositions: 0,
    recentPositions: 0,
    lastUpdate: null as Date | null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get total vehicles
        const { count: vehicleCount, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact' });

        if (vehicleError) {
          console.warn('Error fetching vehicles:', vehicleError);
        }

        // Get total positions
        const { count: positionCount, error: positionError } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' });

        if (positionError) {
          console.warn('Error fetching positions:', positionError);
        }

        // Get recent positions (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: recentCount, error: recentError } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' })
          .gte('timestamp', oneHourAgo);

        if (recentError) {
          console.warn('Error fetching recent positions:', recentError);
        }

        // Get last update time
        const { data: lastPosition, error: lastUpdateError } = await supabase
          .from('vehicle_positions')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        if (lastUpdateError && lastUpdateError.code !== 'PGRST116') {
          console.warn('Error fetching last update:', lastUpdateError);
        }

        setSystemStats({
          totalVehicles: vehicleCount || 0,
          totalPositions: positionCount || 0,
          recentPositions: recentCount || 0,
          lastUpdate: lastPosition ? new Date(lastPosition.timestamp) : null
        });
      } catch (error) {
        console.error('Error fetching system stats:', error);
        setError('Failed to load system statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStats();
    
    // Refresh stats every minute
    const interval = setInterval(fetchSystemStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GPS51 Fleet Management System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* System Overview Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              GPS51 Fleet Management System
            </div>
            <Badge className="bg-blue-100 text-blue-800">Live System</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800 text-sm">{error}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Total Vehicles</p>
                <p className="text-2xl font-bold">{systemStats.totalVehicles.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Total Positions</p>
                <p className="text-2xl font-bold">{systemStats.totalPositions.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Wifi className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Recent (1hr)</p>
                <p className="text-2xl font-bold">{systemStats.recentPositions.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Activity className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Last Update</p>
                <p className="text-lg font-bold">{formatLastUpdate(systemStats.lastUpdate)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Dashboard Interface */}
      <Tabs defaultValue="live-data" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="live-data" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Data
          </TabsTrigger>
          <TabsTrigger value="protection" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Anti-Overload Protection
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="live-data" className="mt-6">
          <GPS51LiveDashboard />
        </TabsContent>
        
        <TabsContent value="protection" className="mt-6">
          <GPS51AntiOverloadDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
