import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FleetStats from '@/components/dashboard/FleetStats';
import VehicleCard from '@/components/dashboard/VehicleCard';
import AIInsights from '@/components/dashboard/AIInsights';
import RealtimeChart from '@/components/dashboard/RealtimeChart';
import GPS51SyncButton from '@/components/dashboard/GPS51SyncButton';
import RealTimeMap from '@/components/dashboard/RealTimeMap';
import MonitoringAlertsPanel from '@/components/dashboard/MonitoringAlertsPanel';
import RealTimeConnectionStatus from '@/components/dashboard/RealTimeConnectionStatus';
import RealTimeGPS51Status from '@/components/dashboard/RealTimeGPS51Status';
import { GPS51RealTimePanel } from '@/components/dashboard/GPS51RealTimePanel';
import { useGPS51Data } from '@/hooks/useGPS51Data';
import { useGPS51ProductionData } from '@/hooks/useGPS51ProductionData';
import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Dashboard = () => {
  // PRODUCTION FIX: Use production-grade data hook
  const { 
    state: productionState, 
    actions: productionActions 
  } = useGPS51ProductionData();
  
  // Fallback to legacy hook for compatibility
  const { vehicles: legacyVehicles, vehiclePositions, loading: legacyLoading } = useGPS51Data();
  
  const [enableRealTime, setEnableRealTime] = useState(true);
  const [enableGPS51RealTime, setEnableGPS51RealTime] = useState(true);

  // Use production data if available, fallback to legacy data
  const vehicles = productionState.isReady ? 
    productionState.vehicles : legacyVehicles;
  const isLoading = productionState.isReady ? 
    productionState.isLoading : legacyLoading;
  
  // Use simplified data for emergency mode
  const mockMetrics = {
    realTimeConnected: !legacyLoading,
    lastUpdateTime: new Date(),
    activeDevices: vehicles.filter(v => v.latest_position?.isMoving).length
  };

  const refreshLiveData = () => {
    // Trigger refresh of GPS51 data
    window.location.reload();
  };

  const triggerPrioritySync = (vehicleIds: string[]) => {
    console.log('Priority sync requested for vehicles:', vehicleIds);
  };

  const intelligentFiltering = false; // Disabled in emergency mode

  // Transform production data to match existing VehicleCard interface
  const transformedVehicles = vehicles.map(vehicle => {
    const hasGPS = !!vehicle.latest_position;
    
    return {
      id: vehicle.id,
      name: `${vehicle.brand || 'GPS51'} ${vehicle.model || 'Vehicle'}`,
      status: vehicle.status === 'available' ? 'online' as const :
              vehicle.status === 'maintenance' ? 'maintenance' as const : 'offline' as const,
      location: hasGPS ? 
        `${vehicle.latest_position!.latitude.toFixed(4)}, ${vehicle.latest_position!.longitude.toFixed(4)}` : 
        'Unknown',
      speed: hasGPS ? vehicle.latest_position!.speed : 0,
      fuel: hasGPS ? (vehicle.latest_position!.fuel_level || 0) : 0,
      temperature: hasGPS ? (vehicle.latest_position!.engine_temperature || 0) : 0,
      lastUpdate: hasGPS ? 
        new Date(vehicle.latest_position!.timestamp).toLocaleString() : 
        'No data',
      aiScore: hasGPS ? 85 : 0,
      hasGPS: hasGPS
    };
  });

  // Separate vehicles with and without GPS for better display
  const vehiclesWithGPS = transformedVehicles.filter(v => v.hasGPS);
  const vehiclesWithoutGPS = transformedVehicles.filter(v => !v.hasGPS);

  const handleToggleRealTime = () => {
    setEnableRealTime(prev => !prev);
  };

  const handleToggleGPS51RealTime = () => {
    setEnableGPS51RealTime(prev => !prev);
  };

  const handlePrioritySync = () => {
    const movingVehicleIds = vehiclesWithGPS
      .filter(v => v.speed > 0)
      .map(v => v.id);
    
    if (movingVehicleIds.length > 0) {
      triggerPrioritySync(movingVehicleIds);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header with sync button and real-time status */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Fleet Dashboard</h2>
              <div className="flex items-center space-x-4">
                <GPS51SyncButton />
              </div>
            </div>

            {/* Real-time Status Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeGPS51Status 
                enabled={enableGPS51RealTime} 
                onToggle={handleToggleGPS51RealTime} 
              />
              <RealTimeConnectionStatus
                connected={mockMetrics.realTimeConnected}
                lastUpdateTime={mockMetrics.lastUpdateTime}
                onRefresh={refreshLiveData}
                onToggleRealTime={handleToggleRealTime}
                vehicleCount={mockMetrics.activeDevices}
              />
            </div>

            {/* Enhanced Dashboard Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="realtime">Real-time Tracking</TabsTrigger>
                <TabsTrigger value="monitoring">Monitoring & Alerts</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <FleetStats />
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RealTimeMap />
                  <AIInsights />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {isLoading ? 'Loading Fleet...' : 'Fleet Status'}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>{vehiclesWithGPS.length} with GPS</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <span>{vehiclesWithoutGPS.length} offline</span>
                      </div>
                      <span>{transformedVehicles.length} total</span>
                    </div>
                  </div>
                  
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-lg"></div>
                      ))}
                    </div>
                  ) : transformedVehicles.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
                      <p className="text-slate-500">No vehicles found. Click "Sync GPS51" to load data.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Vehicles with GPS first */}
                      {vehiclesWithGPS.length > 0 && (
                        <div>
                          <h4 className="text-lg font-medium text-slate-900 mb-4 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>Vehicles with GPS Tracking ({vehiclesWithGPS.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {vehiclesWithGPS.map((vehicle) => (
                              <VehicleCard key={vehicle.id} vehicle={vehicle} />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Vehicles without GPS */}
                      {vehiclesWithoutGPS.length > 0 && (
                        <div>
                          <h4 className="text-lg font-medium text-slate-700 mb-4 flex items-center space-x-2">
                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                            <span>Vehicles without GPS ({vehiclesWithoutGPS.length})</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {vehiclesWithoutGPS.slice(0, 8).map((vehicle) => (
                              <VehicleCard key={vehicle.id} vehicle={vehicle} />
                            ))}
                          </div>
                          {vehiclesWithoutGPS.length > 8 && (
                            <div className="text-center py-4">
                              <p className="text-sm text-slate-500">
                                Showing 8 of {vehiclesWithoutGPS.length} vehicles without GPS data
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="realtime" className="space-y-6">
                <GPS51RealTimePanel />
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-6">
                <MonitoringAlertsPanel />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AIInsights />
                  <RealtimeChart />
                </div>
                <div className="bg-white p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4">Advanced Analytics Coming Soon</h3>
                  <p className="text-slate-600">
                    Phase 5 will include advanced analytics features such as:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-slate-600">
                    <li>Vehicle utilization patterns</li>
                    <li>Predictive positioning algorithms</li>
                    <li>Cost optimization recommendations</li>
                    <li>Performance trend analysis</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
    </div>
  );
};

export default Dashboard;
