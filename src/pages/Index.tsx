import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductionReadyDashboard } from '@/components/dashboard/ProductionReadyDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, Users, MapPin, Settings } from 'lucide-react';

const Index = () => {
  const [systemStatus, setSystemStatus] = useState({
    isInitialized: false,
    isLiveDataActive: false,
    vehicleCount: 0,
    lastUpdate: null as Date | null,
    hasError: false
  });

  useEffect(() => {
    // Listen for GPS51 system events
    const handleGPS51Ready = () => {
      console.log('Index: GPS51 system ready event received');
      setSystemStatus(prev => ({
        ...prev,
        isInitialized: true,
        hasError: false
      }));
    };

    const handleGPS51NotReady = (event: CustomEvent) => {
      console.log('Index: GPS51 system not ready:', event.detail);
      setSystemStatus(prev => ({
        ...prev,
        isInitialized: false,
        hasError: false
      }));
    };

    const handleGPS51Error = (event: CustomEvent) => {
      console.log('Index: GPS51 system error:', event.detail);
      setSystemStatus(prev => ({
        ...prev,
        isInitialized: false,
        hasError: true
      }));
    };

    // Listen for live data updates
    const handleLiveDataUpdate = (event: CustomEvent) => {
      const data = event.detail;
      console.log('Index: Live data update received:', {
        devices: data.devices?.length || 0,
        positions: data.positions?.length || 0,
        lastUpdate: data.lastUpdate
      });
      
      setSystemStatus(prev => ({
        ...prev,
        vehicleCount: data.devices?.length || 0,
        lastUpdate: data.lastUpdate || new Date(),
        isLiveDataActive: true,
        isInitialized: true,
        hasError: false
      }));
    };

    // Add event listeners
    window.addEventListener('gps51-system-ready', handleGPS51Ready);
    window.addEventListener('gps51-system-not-ready', handleGPS51NotReady as EventListener);
    window.addEventListener('gps51-system-error', handleGPS51Error as EventListener);
    window.addEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);

    // Set initial timeout to show page even if GPS51 fails
    const initTimeout = setTimeout(() => {
      console.log('Index: Initialization timeout - showing page');
      setSystemStatus(prev => ({
        ...prev,
        isInitialized: false,
        hasError: false
      }));
    }, 5000);

    return () => {
      clearTimeout(initTimeout);
      window.removeEventListener('gps51-system-ready', handleGPS51Ready);
      window.removeEventListener('gps51-system-not-ready', handleGPS51NotReady as EventListener);
      window.removeEventListener('gps51-system-error', handleGPS51Error as EventListener);
      window.removeEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);
    };
  }, []);

  const getStatusBadge = () => {
    if (systemStatus.hasError) {
      return <Badge variant="destructive">System Error</Badge>;
    } else if (systemStatus.isInitialized && systemStatus.isLiveDataActive) {
      return <Badge className="bg-green-100 text-green-800">Live & Active</Badge>;
    } else if (systemStatus.isInitialized) {
      return <Badge className="bg-blue-100 text-blue-800">Connected</Badge>;
    } else {
      return <Badge variant="secondary">Not Configured</Badge>;
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
                  {systemStatus.isInitialized ? 'Connected' : 'Not Configured'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <MapPin className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-slate-600">Live Data</p>
                <p className="text-lg font-bold">
                  {systemStatus.isLiveDataActive ? 'Active' : 'Inactive'}
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

      {/* Production Ready Dashboard or Configuration Prompt */}
      {systemStatus.isInitialized ? (
        <ProductionReadyDashboard />
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center mb-4">
                <Settings className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600">GPS51 System Ready for Configuration</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Your GPS51 fleet management system is ready to be configured. 
                Set up your GPS51 API credentials to start tracking vehicles in real-time.
              </p>
              <div className="mt-4">
                <Link 
                  to="/settings" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure GPS51
                </Link>
              </div>
              <div className="mt-4 text-xs text-gray-400">
                <p>System Status: Production Ready • Error Boundaries: Active • Fallbacks: Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;