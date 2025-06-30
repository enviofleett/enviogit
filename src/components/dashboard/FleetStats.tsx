
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Monitor, Zap, Shield, Settings, MapPin } from 'lucide-react';
import { useGPS51Data } from '@/hooks/useGPS51Data';
import { useGPS51LiveData } from '@/hooks/useGPS51LiveData';

const FleetStats = () => {
  const { vehicles, loading: vehiclesLoading } = useGPS51Data();
  const { metrics, loading: metricsLoading } = useGPS51LiveData();

  const loading = vehiclesLoading || metricsLoading;

  // Calculate additional stats from vehicle data
  const totalVehicles = vehicles.length;
  const vehiclesWithPositions = vehicles.filter(v => v.latest_position).length;
  const vehiclesWithoutPositions = totalVehicles - vehiclesWithPositions;
  const activeVehicles = vehicles.filter(v => v.latest_position?.isMoving).length;
  const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;

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
