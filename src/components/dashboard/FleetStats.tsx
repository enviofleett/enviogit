
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, Zap, Shield, Settings, MapPin } from 'lucide-react';
import { useGPS51UnifiedData } from '@/hooks/useGPS51UnifiedData';

const FleetStats = () => {
  const { state } = useGPS51UnifiedData();

  // Calculate stats from unified GPS51 data
  const totalVehicles = state.devices.length;
  const vehiclesWithPositions = state.positions.length;
  const vehiclesWithoutPositions = totalVehicles - vehiclesWithPositions;
  const activeVehicles = state.positions.filter(p => p.moving === 1).length;
  const maintenanceVehicles = 0; // Not available in GPS51 data
  const loading = state.isLoading;

  const stats = [
    {
      title: 'Total Fleet',
      value: loading ? '...' : totalVehicles.toString(),
      change: `${vehiclesWithPositions} with GPS data`,
      icon: Monitor,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Active Now',
      value: loading ? '...' : activeVehicles.toString(),
      change: 'Engines running',
      icon: Zap,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'GPS Tracking',
      value: loading ? '...' : vehiclesWithPositions.toString(),
      change: `${vehiclesWithoutPositions} offline`,
      icon: MapPin,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Maintenance',
      value: loading ? '...' : maintenanceVehicles.toString(),
      change: 'Scheduled',
      icon: Settings,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{stat.change}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default FleetStats;
