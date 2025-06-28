
import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import FleetStats from '@/components/dashboard/FleetStats';
import VehicleCard from '@/components/dashboard/VehicleCard';
import AIInsights from '@/components/dashboard/AIInsights';
import RealtimeChart from '@/components/dashboard/RealtimeChart';

const Dashboard = () => {
  const vehicles = [
    {
      id: 'VH-001',
      name: 'Delivery Van Alpha',
      status: 'online' as const,
      location: 'Downtown Hub',
      speed: 45,
      fuel: 78,
      temperature: 92,
      lastUpdate: '2 min ago',
      aiScore: 94
    },
    {
      id: 'VH-002',
      name: 'Cargo Truck Beta',
      status: 'online' as const,
      location: 'Highway 101',
      speed: 65,
      fuel: 42,
      temperature: 89,
      lastUpdate: '1 min ago',
      aiScore: 87
    },
    {
      id: 'VH-003',
      name: 'Service Van Gamma',
      status: 'maintenance' as const,
      location: 'Service Center',
      speed: 0,
      fuel: 95,
      temperature: 78,
      lastUpdate: '15 min ago',
      aiScore: 76
    },
    {
      id: 'VH-004',
      name: 'Pickup Truck Delta',
      status: 'offline' as const,
      location: 'Parking Lot B',
      speed: 0,
      fuel: 23,
      temperature: 85,
      lastUpdate: '2 hours ago',
      aiScore: 82
    }
  ];

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <FleetStats />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RealtimeChart />
              <AIInsights />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Active Fleet</h3>
                <div className="flex items-center space-x-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live updates every 30 seconds</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
