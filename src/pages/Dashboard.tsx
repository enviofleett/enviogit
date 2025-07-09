import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FleetStats from '@/components/dashboard/FleetStats';
import VehicleCard from '@/components/dashboard/VehicleCard';
import AIInsights from '@/components/dashboard/AIInsights';
import RealtimeChart from '@/components/dashboard/RealtimeChart';

import RealTimeMap from '@/components/dashboard/RealTimeMap';
import MonitoringAlertsPanel from '@/components/dashboard/MonitoringAlertsPanel';
import RealTimeConnectionStatus from '@/components/dashboard/RealTimeConnectionStatus';
import RealTimeGPS51Status from '@/components/dashboard/RealTimeGPS51Status';
import { GPS51RealTimePanel } from '@/components/dashboard/GPS51RealTimePanel';
import { GPS51PerformanceMonitor } from '@/components/dashboard/GPS51PerformanceMonitor';
import { GPS51IntelligentPollingMonitor } from '@/components/dashboard/GPS51IntelligentPollingMonitor';
import { GPS51FleetHierarchyPanel } from '@/components/dashboard/GPS51FleetHierarchyPanel';
import { useGPS51UnifiedData } from '@/hooks/useGPS51UnifiedData';
import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Dashboard = () => {
  // Use unified GPS51 service
  const { state, actions } = useGPS51UnifiedData();
  
  const [enableRealTime, setEnableRealTime] = useState(true);
  const [enableGPS51RealTime, setEnableGPS51RealTime] = useState(true);

  // Transform unified GPS51 data to dashboard format with real status
  const vehicles = state.devices.map(device => {
    const position = state.positions.find(p => p.deviceid === device.deviceid);
    const hasRecentPosition = position && (Date.now() - (position.updatetime * 1000)) < 300000; // 5 minutes
    const isMoving = position && position.moving === 1 && (position.speed || 0) > 1;
    
    return {
      id: device.deviceid,
      brand: 'GPS51',
      model: device.devicename || `Vehicle ${device.deviceid}`,
      license_plate: device.devicename || device.deviceid,
      status: hasRecentPosition ? (isMoving ? 'active' : 'available') : 'inactive',
      type: 'vehicle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: '',
      gps51_device_id: device.deviceid,
      latest_position: position ? {
        vehicle_id: device.deviceid,
        latitude: Number(position.callat),
        longitude: Number(position.callon),
        speed: Number(position.speed || 0),
        timestamp: new Date(position.updatetime * 1000).toISOString(),
        status: position.strstatus || position.strstatusen || 'Unknown',
        isMoving: isMoving,
        ignition_status: position.moving === 1,
        heading: position.course,
        fuel_level: position.totaloil || undefined,
        engine_temperature: position.temp1 || undefined
      } : null
    };
  });
  const isLoading = state.isLoading;
  
  // Real-time metrics from live GPS51 data
  const liveMetrics = {
    realTimeConnected: state.isAuthenticated && state.pollingActive,
    lastUpdateTime: state.lastUpdate || new Date(),
    activeDevices: vehicles.filter(v => v.latest_position?.isMoving).length,
    totalDevices: vehicles.length,
    onlineDevices: vehicles.filter(v => v.latest_position).length,
    offlineDevices: vehicles.filter(v => !v.latest_position).length,
    movingVehicles: state.positions.filter(p => p.moving === 1).length,
    parkedVehicles: state.positions.filter(p => p.moving === 0).length
  };

  const refreshLiveData = () => {
    // Automatic background refresh - no manual intervention needed
    actions.refreshData();
  };

  // Transform live GPS51 data for display with real-time status
  const transformedVehicles = vehicles.map(vehicle => {
    const hasGPS = !!vehicle.latest_position;
    const position = vehicle.latest_position;
    const isRecentUpdate = hasGPS && (Date.now() - new Date(position!.timestamp).getTime()) < 300000; // 5 minutes
    const realStatus = hasGPS && isRecentUpdate ? 
      (position!.isMoving ? 'online' as const : 'maintenance' as const) : 
      'offline' as const;
    
    return {
      id: vehicle.id,
      name: vehicle.model,
      status: realStatus,
      location: hasGPS ? 
        `${position!.latitude.toFixed(6)}, ${position!.longitude.toFixed(6)}` : 
        'GPS Offline',
      speed: hasGPS ? Math.round(position!.speed) : 0,
      fuel: hasGPS ? Math.round(position!.fuel_level || 0) : 0,
      temperature: hasGPS ? Math.round(position!.engine_temperature || 25) : 0,
      lastUpdate: hasGPS ? 
        new Date(position!.timestamp).toLocaleString() : 
        'Never',
      aiScore: hasGPS && isRecentUpdate ? 95 : (hasGPS ? 70 : 0),
      hasGPS: hasGPS && isRecentUpdate,
      rawData: vehicle // Keep original for debugging
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


  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header with live status indicator */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Live Fleet Dashboard</h2>
                <div className="flex items-center space-x-4 mt-1">
                  {state.pollingActive ? (
                    <div className="flex items-center space-x-2 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Live Tracking Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-yellow-600">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-medium">Connecting...</span>
                    </div>
                  )}
                  {state.lastUpdate && (
                    <span className="text-sm text-slate-500">
                      Last update: {state.lastUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">
                  {state.devices.length} Vehicles
                </div>
                <div className="text-sm text-slate-500">
                  {state.positions.filter(p => p.moving === 1).length} moving • {state.positions.filter(p => p.moving === 0).length} parked
                </div>
              </div>
            </div>

            {/* Real-time Status Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeGPS51Status 
                enabled={enableGPS51RealTime} 
                onToggle={handleToggleGPS51RealTime} 
              />
              <RealTimeConnectionStatus
                connected={liveMetrics.realTimeConnected}
                lastUpdateTime={liveMetrics.lastUpdateTime}
                onRefresh={refreshLiveData}
                onToggleRealTime={handleToggleRealTime}
                vehicleCount={liveMetrics.activeDevices}
              />
            </div>

            {/* Enhanced Dashboard Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="realtime">Real-time</TabsTrigger>
                <TabsTrigger value="fleet">Fleet Mgmt</TabsTrigger>
                <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
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
                      Live Fleet Status
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>{liveMetrics.movingVehicles} moving</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span>{liveMetrics.parkedVehicles} parked</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <span>{liveMetrics.offlineDevices} offline</span>
                      </div>
                      <span className="font-medium">{liveMetrics.totalDevices} total</span>
                    </div>
                  </div>
                  
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-lg"></div>
                      ))}
                    </div>
                  ) : state.error ? (
                    <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-red-600 font-medium">Connection Error</p>
                      <p className="text-red-500 text-sm mt-1">{state.error}</p>
                      <p className="text-slate-500 text-sm mt-2">System will auto-retry...</p>
                    </div>
                  ) : transformedVehicles.length === 0 ? (
                    <div className="text-center py-12 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-yellow-700 font-medium">No vehicles configured</p>
                      <p className="text-yellow-600 text-sm mt-1">Please configure GPS51 credentials in Settings</p>
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

              <TabsContent value="fleet" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GPS51FleetHierarchyPanel />
                  <GPS51IntelligentPollingMonitor />
                </div>
              </TabsContent>

              <TabsContent value="monitoring" className="space-y-6">
                <MonitoringAlertsPanel />
              </TabsContent>

              <TabsContent value="performance" className="space-y-6">
                <GPS51PerformanceMonitor />
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
