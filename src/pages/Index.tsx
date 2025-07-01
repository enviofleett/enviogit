
import { useEffect, useState } from 'react';
import GPS51LiveDashboard from '@/components/dashboard/GPS51LiveDashboard';
import GPS51AntiOverloadDashboard from '@/components/dashboard/GPS51AntiOverloadDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Wifi, Users, MapPin, Shield, AlertCircle, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const Index = () => {
  const [systemStats, setSystemStats] = useState({
    totalVehicles: 0,
    totalPositions: 0,
    recentPositions: 0,
    lastUpdate: null as Date | null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGPS51Configured, setIsGPS51Configured] = useState(false);

  useEffect(() => {
    const checkGPS51Configuration = () => {
      try {
        const apiUrl = localStorage.getItem('gps51_api_url');
        const username = localStorage.getItem('gps51_username');
        const passwordHash = localStorage.getItem('gps51_password_hash');
        
        setIsGPS51Configured(!!(apiUrl && username && passwordHash));
      } catch (error) {
        console.error('Error checking GPS51 configuration:', error);
        setIsGPS51Configured(false);
      }
    };

    checkGPS51Configuration();
  }, []);

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get total vehicles
        const { count: vehicleCount, error: vehicleError } = await supabase
          .from('vehicles')
          .select('*', { count: 'exact' });

        if (vehicleError && vehicleError.code !== 'PGRST116') {
          console.warn('Error fetching vehicles:', vehicleError);
        }

        // Get total positions
        const { count: positionCount, error: positionError } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' });

        if (positionError && positionError.code !== 'PGRST116') {
          console.warn('Error fetching positions:', positionError);
        }

        // Get recent positions (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: recentCount, error: recentError } = await supabase
          .from('vehicle_positions')
          .select('*', { count: 'exact' })
          .gte('timestamp', oneHourAgo);

        if (recentError && recentError.code !== 'PGRST116') {
          console.warn('Error fetching recent positions:', recentError);
        }

        // Get last update time
        const { data: lastPosition, error: lastUpdateError } = await supabase
          .from('vehicle_positions')
          .select('timestamp')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

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
            <div className="flex items-center gap-2">
              <Badge className={isGPS51Configured ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}>
                {isGPS51Configured ? 'Live System' : 'Configuration Required'}
              </Badge>
              {!isGPS51Configured && (
                <Button asChild size="sm">
                  <Link to="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Link>
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800 text-sm">{error}</span>
            </div>
          )}

          {!isGPS51Configured && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-800">GPS51 Configuration Required</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    To view live vehicle data and enable real-time tracking, please configure your GPS51 API credentials in Settings.
                  </p>
                </div>
              </div>
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

      {/* Conditional Dashboard Content */}
      {isGPS51Configured ? (
        // Show full dashboard when GPS51 is configured
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
      ) : (
        // Show configuration prompt when GPS51 is not configured
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Get Started with GPS51 Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Connect your GPS51 platform to unlock powerful fleet management features:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium">Real-Time Tracking</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Monitor vehicle positions, speed, and status in real-time with automatic data synchronization.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <h3 className="font-medium">Anti-Overload Protection</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Built-in protection against API rate limits with intelligent request management and circuit breakers.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure GPS51 Now
                </Link>
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
