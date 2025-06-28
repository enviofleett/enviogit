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
  const vehicles = gps51Vehicles.map(vehicle => ({
    id: vehicle.id,
    name: `${vehicle.brand || 'GPS51'} ${vehicle.model || 'Vehicle'}`,
    status: vehicle.status === 'available' ? 'online' as const :
            vehicle.status === 'maintenance' ? 'maintenance' as const : 'offline' as const,
    location: vehicle.latest_position ? 
      `${vehicle.latest_position.latitude.toFixed(4)}, ${vehicle.latest_position.longitude.toFixed(4)}` : 
      'Unknown',
    speed: vehicle.latest_position?.speed || 0,
    fuel: vehicle.latest_position?.fuel_level || 0,
    temperature: vehicle.latest_position?.engine_temperature || 0,
    lastUpdate: vehicle.latest_position ? 
      new Date(vehicle.latest_position.timestamp).toLocaleString() : 
      'No data',
    aiScore: 85 // Will be calculated based on real telemetry data
  }));

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Add GPS51 sync button */}
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
                  {gps51Loading ? 'Loading GPS51 Fleet...' : 'GPS51 Fleet Status'}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live GPS51 data</span>
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
                  <p className="text-slate-500">No GPS51 vehicles found. Click "Sync GPS51" to load data.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {vehicles.map((vehicle) => (
                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                  ))}
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
