
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { useGPS51UnifiedData } from '@/hooks/useGPS51UnifiedData';
import FleetMetricsCards from './gps51/FleetMetricsCards';
import DataStatusCard from './gps51/DataStatusCard';
import VehicleListCard from './gps51/VehicleListCard';

const GPS51LiveDataDashboard: React.FC = () => {
  const { state, actions } = useGPS51UnifiedData();
  const { devices: vehicles, isLoading: loading, error } = state;
  
  // Mock enhanced metrics for compatibility with the card components
  const metrics = {
    totalDevices: vehicles.length,
    activeDevices: vehicles.filter(v => v.lastactivetime && Date.now() - v.lastactivetime < 300000).length,
    movingVehicles: state.positions.filter(p => p.moving === 1).length,
    parkedVehicles: state.positions.filter(p => p.moving === 0).length,
    offlineVehicles: Math.max(0, vehicles.length - state.positions.length),
    avgResponseTime: 0,
    dataFreshness: 'live' as const,
    totalDistance: 0,
    fuelConsumption: 0,
    alerts: 0,
    averageSpeed: state.positions.reduce((sum, p) => sum + (p.speed || 0), 0) / Math.max(1, state.positions.length),
    devicesWithAlarms: 0,
    fuelAlerts: 0,
    temperatureAlerts: 0,
    lastUpdateTime: state.lastUpdate || new Date()
  };
  
  const liveData = {
    devices: vehicles,
    positions: state.positions,
    lastQueryPositionTime: 0,
    lastUpdate: state.lastUpdate || new Date()
  };
  
  // Convert GPS51Device to VehicleWithEnhancedData format
  const enhancedVehicles = vehicles.map(vehicle => ({
    device: vehicle,
    isOnline: state.positions.some(p => p.deviceid === vehicle.deviceid),
    isMoving: state.positions.find(p => p.deviceid === vehicle.deviceid)?.moving === 1 || false,
    hasAlarms: false,
    lastSeen: new Date(vehicle.lastactivetime || Date.now())
  }));

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
            onClick={actions.refreshData}
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
      <VehicleListCard vehicles={enhancedVehicles} loading={loading} onRefresh={actions.refreshData} />
    </div>
  );
};

export default GPS51LiveDataDashboard;
