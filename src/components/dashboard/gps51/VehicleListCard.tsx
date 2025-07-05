
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { VehicleWithEnhancedData } from '@/hooks/useGPS51VehicleData';
import VehicleDetailItem from './VehicleDetailItem';

interface VehicleListCardProps {
  vehicles: VehicleWithEnhancedData[];
  loading: boolean;
  onRefresh: () => void;
}

const VehicleListCard: React.FC<VehicleListCardProps> = ({ vehicles, loading, onRefresh }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Live Vehicle Data</span>
          <button
            onClick={onRefresh}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {vehicles.map((vehicleData) => (
            <VehicleDetailItem
              key={vehicleData.device.deviceid}
              vehicleData={vehicleData}
            />
          ))}

          {vehicles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No vehicle data available</p>
              <button
                onClick={onRefresh}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Load Data
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VehicleListCard;
