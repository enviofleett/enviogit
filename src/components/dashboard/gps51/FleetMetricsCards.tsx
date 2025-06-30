
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  Navigation, 
  AlertTriangle, 
  Activity
} from 'lucide-react';
import { EnhancedFleetMetrics } from '@/hooks/useGPS51FleetMetrics';

interface FleetMetricsCardsProps {
  metrics: EnhancedFleetMetrics;
}

const FleetMetricsCards: React.FC<FleetMetricsCardsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Vehicles</p>
              <p className="text-2xl font-bold">{metrics.totalDevices}</p>
            </div>
            <MapPin className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Now</p>
              <p className="text-2xl font-bold text-green-600">{metrics.activeDevices}</p>
            </div>
            <Activity className="w-8 h-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Moving</p>
              <p className="text-2xl font-bold text-blue-600">{metrics.movingVehicles}</p>
            </div>
            <Navigation className="w-8 h-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Alerts</p>
              <p className="text-2xl font-bold text-orange-600">
                {metrics.devicesWithAlarms + metrics.fuelAlerts + metrics.temperatureAlerts}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FleetMetricsCards;
