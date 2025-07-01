import { useEffect, useState } from 'react';
import GPS51LiveDataDashboard from '@/components/dashboard/GPS51LiveDataDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, Users, MapPin } from 'lucide-react';
import { gps51StartupService } from '@/services/gps51/GPS51StartupService';

const Index = () => {
  const [systemStatus, setSystemStatus] = useState({
    isInitialized: false,
    isLiveDataActive: false,
    vehicleCount: 0,
    lastUpdate: null as Date | null
  });

  useEffect(() => {
    const checkSystemStatus = () => {
      const isInitialized = gps51StartupService.isSystemInitialized();
      const liveDataService = gps51StartupService.getLiveDataService();
      const serviceStatus = liveDataService.getServiceStatus();
      const currentState = liveDataService.getCurrentState();
      
      setSystemStatus({
        isInitialized,
        isLiveDataActive: serviceStatus.isPolling,
        vehicleCount: currentState.devices.length,
        lastUpdate: currentState.lastUpdate
      });
    };

    // Initial check
    checkSystemStatus();

    // Listen for live data updates
    const handleLiveDataUpdate = (event: CustomEvent) => {
      const data = event.detail;
      setSystemStatus(prev => ({
        ...prev,
        vehicleCount: data.devices.length,
        lastUpdate: data.lastUpdate,
        isLiveDataActive: true
      }));
    };

    window.addEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);

    // Check status every 10 seconds
    const interval = setInterval(checkSystemStatus, 10000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
    };
  }, []);

  const getStatusBadge = () => {
    if (systemStatus.isInitialized && systemStatus.isLiveDataActive) {
      return <Badge className="bg-green-100 text-green-800">Live & Active</Badge>;
    } else if (systemStatus.isInitialized) {
      return <Badge className="bg-blue-100 text-blue-800">Connected</Badge>;
    } else {
      return <Badge variant="secondary">Initializing</Badge>;
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
    <div className="p-6 space-y-6">
      {/* System Status Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              GPS51 Fleet Management System
            </div>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-slate-600">Live Vehicles</p>
                <p className="text-2xl font-bold">{systemStatus.vehicleCount.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Wifi className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-slate-600">Connection</p>
                <p className="text-lg font-bold">
                  {systemStatus.isInitialized ? 'Connected' : 'Connecting...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Live Data</p>
                <p className="text-lg font-bold">
                  {systemStatus.isLiveDataActive ? 'Active' : 'Starting...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Activity className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-slate-600">Last Update</p>
                <p className="text-lg font-bold">{formatLastUpdate(systemStatus.lastUpdate)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Data Dashboard */}
      {systemStatus.isInitialized ? (
        <GPS51LiveDataDashboard />
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Initializing GPS51 system...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
