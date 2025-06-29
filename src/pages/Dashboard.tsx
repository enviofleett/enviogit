
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FleetStats from '@/components/dashboard/FleetStats';
import VehicleCard from '@/components/dashboard/VehicleCard';
import AIInsights from '@/components/dashboard/AIInsights';
import RealtimeChart from '@/components/dashboard/RealtimeChart';
import GPS51SyncButton from '@/components/dashboard/GPS51SyncButton';
import RealTimeMap from '@/components/dashboard/RealTimeMap';
import { useGPS51Data } from '@/hooks/useGPS51Data';

const Dashboard = () => {
  const { vehicles: gps51Vehicles, loading: gps51Loading } = useGPS51Data();

  // Transform GPS51 data to match existing VehicleCard interface
  const vehicles = gps51Vehicles.map(vehicle => {
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
      aiScore: hasGPS ? 85 : 0, // Will be calculated based on real telemetry data
      hasGPS: hasGPS
    };
  });

  // Separate vehicles with and without GPS for better display
  const vehiclesWithGPS = vehicles.filter(v => v.hasGPS);
  const vehiclesWithoutGPS = vehicles.filter(v => !v.hasGPS);

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Header with sync button */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Fleet Dashboard</h2>
              <GPS51SyncButton />
            </div>

            <FleetStats />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealTimeMap />
              <AIInsights />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">
                  {gps51Loading ? 'Loading Fleet...' : 'Fleet Status'}
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
                  <span>{vehicles.length} total</span>
                </div>
              </div>
              
              {gps51Loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-48 bg-slate-200 animate-pulse rounded-lg"></div>
                  ))}
                </div>
              ) : vehicles.length === 0 ? (
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
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
