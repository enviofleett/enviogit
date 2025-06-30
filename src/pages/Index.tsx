
import { useEffect, useState } from 'react';
import GPS51LiveDashboard from '@/components/dashboard/GPS51LiveDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, Users, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [systemStats, setSystemStats] = useState({
    totalVehicles: 0,
    totalPositions: 0,
    recentPositions: 0,
    lastUpdate: null as Date | null
  });

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        // Get total vehicles
        const { count: vehicleCount } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact' });

        // Get total positions
        const { count: positionCount } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' });

        // Get recent positions (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: recentCount } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' })
          .gte('timestamp', oneHourAgo);

        // Get last update time
        const { data: lastPosition } = await supabase
          .from('vehicle_positions')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        setSystemStats({
          totalVehicles: vehicleCount || 0,
          totalPositions: positionCount || 0,
          recentPositions: recentCount || 0,
          lastUpdate: lastPosition ? new Date(lastPosition.timestamp) : null
        });
      } catch (error) {
        console.error('Error fetching system stats:', error);
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

      {/* Live Data Dashboard */}
      <GPS51LiveDashboard />
    </div>
  );
};

export default Index;
