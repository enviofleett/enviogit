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
    const initializeSystem = async () => {
      console.log('Index: Initializing GPS51 system...');
      
      try {
        // Initialize authentication and start services
        const initialized = await gps51StartupService.initializeAuthentication();
        console.log('Index: System initialization result:', initialized);
        
        if (initialized) {
          checkSystemStatus();
        } else {
          // Set status to show system is not configured but don't show loading spinner
          setSystemStatus(prev => ({
            ...prev,
            isInitialized: false,
            isLiveDataActive: false,
            vehicleCount: 0,
            lastUpdate: null
          }));
        }
      } catch (error) {
        console.error('Index: GPS51 initialization error:', error);
        // Set status to show error state
        setSystemStatus(prev => ({
          ...prev,
          isInitialized: false,
          isLiveDataActive: false,
          vehicleCount: 0,
          lastUpdate: null
        }));
      }
    };

    const checkSystemStatus = () => {
      try {
        const isInitialized = gps51StartupService.isSystemInitialized();
        const liveDataManager = gps51StartupService.getLiveDataManager();
        const serviceStatus = liveDataManager.getStatus();
        const currentState = liveDataManager.getCurrentState();
        
        console.log('Index: System status check:', {
          isInitialized,
          isActive: serviceStatus.isActive,
          deviceCount: currentState.devices.length,
          lastUpdate: currentState.lastUpdate
        });
        
        setSystemStatus({
          isInitialized,
          isLiveDataActive: serviceStatus.isActive,
          vehicleCount: currentState.devices.length,
          lastUpdate: currentState.lastUpdate
        });
      } catch (error) {
        console.error('Index: Status check error:', error);
        setSystemStatus(prev => ({
          ...prev,
          isInitialized: false,
          isLiveDataActive: false
        }));
      }
    };

    // Initialize system with timeout to prevent infinite loading
    const initTimeout = setTimeout(() => {
      console.warn('Index: GPS51 initialization timeout - showing page anyway');
      setSystemStatus(prev => ({
        ...prev,
        isInitialized: false,
        isLiveDataActive: false,
        vehicleCount: 0,
        lastUpdate: null
      }));
    }, 10000); // 10 second timeout

    initializeSystem().finally(() => {
      clearTimeout(initTimeout);
    });

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
        isInitialized: true
      }));
    };

    window.addEventListener('gps51-live-data-update', handleLiveDataUpdate as EventListener);

    // Check status every 30 seconds (only if initialized)
    const interval = setInterval(() => {
      if (gps51StartupService.isSystemInitialized()) {
        checkSystemStatus();
      }
    }, 30000);

    return () => {
      clearTimeout(initTimeout);
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
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center mb-4">
                <Activity className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600">GPS51 System Not Configured</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                To start tracking vehicles, please configure your GPS51 credentials in the Settings page.
              </p>
              <div className="mt-4">
                <a 
                  href="/settings" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Settings
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Index;
