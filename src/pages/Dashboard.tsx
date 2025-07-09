import React from 'react';
import Header from '@/components/layout/Header';
import FleetStats from '@/components/dashboard/FleetStats';
import VehicleCard from '@/components/dashboard/VehicleCard';
import AIInsights from '@/components/dashboard/AIInsights';
import RealtimeChart from '@/components/dashboard/RealtimeChart';
import RealTimeMap from '@/components/dashboard/RealTimeMap';
import { useGPS51UnifiedData } from '@/hooks/useGPS51UnifiedData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const DashboardNew = () => {
  // Use unified GPS51 service with automatic real-time updates
  const { state } = useGPS51UnifiedData();
  
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-100">
      <Header />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Header with live status indicator - NO MANUAL CONTROLS */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Production Fleet Dashboard</h2>
              <div className="flex items-center space-x-4 mt-1">
                {state.pollingActive ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Live Tracking Active</span>
                  </div>
                ) : state.isAuthenticated ? (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Connecting...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-yellow-600">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium">Authentication Required</span>
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
                {liveMetrics.movingVehicles} moving • {liveMetrics.parkedVehicles} parked • {liveMetrics.offlineDevices} offline
              </div>
            </div>
          </div>

          {/* Enhanced Dashboard Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Live Overview</TabsTrigger>
              <TabsTrigger value="fleet">Fleet Status</TabsTrigger>
              <TabsTrigger value="map">Live Map</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <FleetStats />
              
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
                
                {state.isLoading ? (
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
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Live Vehicles ({vehiclesWithGPS.length})</span>
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
                          <span>Offline Vehicles ({vehiclesWithoutGPS.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {vehiclesWithoutGPS.slice(0, 8).map((vehicle) => (
                            <VehicleCard key={vehicle.id} vehicle={vehicle} />
                          ))}
                        </div>
                        {vehiclesWithoutGPS.length > 8 && (
                          <div className="text-center py-4">
                            <p className="text-sm text-slate-500">
                              Showing 8 of {vehiclesWithoutGPS.length} offline vehicles
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="fleet" className="space-y-6">
              <FleetStats />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4">Fleet Performance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Active Rate</span>
                      <span className="font-medium">{((liveMetrics.activeDevices / liveMetrics.totalDevices) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Online Rate</span>
                      <span className="font-medium">{((liveMetrics.onlineDevices / liveMetrics.totalDevices) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">GPS Coverage</span>
                      <span className="font-medium">{((liveMetrics.onlineDevices / liveMetrics.totalDevices) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4">System Status</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Connection</span>
                      <span className={`font-medium ${state.isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                        {state.isAuthenticated ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Live Tracking</span>
                      <span className={`font-medium ${state.pollingActive ? 'text-green-600' : 'text-yellow-600'}`}>
                        {state.pollingActive ? 'Active' : 'Initializing'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Update Interval</span>
                      <span className="font-medium text-blue-600">15 seconds</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="map" className="space-y-6">
              <RealTimeMap />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AIInsights />
                <RealtimeChart />
              </div>
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Live Analytics</h3>
                <p className="text-slate-600">
                  Real-time analytics dashboard showing live vehicle performance and tracking data.
                </p>
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{liveMetrics.movingVehicles}</div>
                    <div className="text-sm text-slate-500">Moving Now</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{liveMetrics.parkedVehicles}</div>
                    <div className="text-sm text-slate-500">Parked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{liveMetrics.onlineDevices}</div>
                    <div className="text-sm text-slate-500">Online</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-600">{liveMetrics.offlineDevices}</div>
                    <div className="text-sm text-slate-500">Offline</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default DashboardNew;