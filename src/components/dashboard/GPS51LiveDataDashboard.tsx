
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useGPS51LiveDataEnhanced } from '@/hooks/useGPS51LiveDataEnhanced';
import FleetMetricsCards from './gps51/FleetMetricsCards';
import DataStatusCard from './gps51/DataStatusCard';
import VehicleListCard from './gps51/VehicleListCard';

const GPS51LiveDataDashboard: React.FC = () => {
  const { 
    metrics, 
    vehicles, 
    loading, 
    error, 
    refresh,
    liveData 
  } = useGPS51LiveDataEnhanced({
    enabled: true,
    pollingInterval: 30000,
    autoStart: true
  });

  if (loading && vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading live GPS51 data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
            <h3 className="text-red-600 font-semibold">GPS51 Live Data Error</h3>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <FleetMetricsCards metrics={metrics} />
      <DataStatusCard metrics={metrics} liveData={liveData} />
      <VehicleListCard vehicles={vehicles} loading={loading} onRefresh={refresh} />
    </div>
  );
};

export default GPS51LiveDataDashboard;
