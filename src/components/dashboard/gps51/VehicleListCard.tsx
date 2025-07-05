import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Car, MapPin, Clock } from 'lucide-react';

interface Vehicle {
  id: string;
  name: string;
  status: string;
  lastUpdate: Date | null;
  latitude?: number;
  longitude?: number;
}

interface VehicleListCardProps {
  vehicles: Vehicle[];
  loading: boolean;
  onRefresh: () => void;
}

const VehicleListCard: React.FC<VehicleListCardProps> = ({ vehicles, loading, onRefresh }) => {
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'No data';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'online':
        return 'default';
      case 'inactive':
      case 'offline':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Vehicle Fleet ({vehicles?.length || 0})
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {!vehicles || vehicles.length === 0 ? (
          <div className="text-center py-8">
            <Car className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No vehicles found</p>
            <p className="text-sm text-gray-400 mt-1">
              Check your GPS51 configuration in Settings
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {vehicles.slice(0, 10).map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{vehicle.name || vehicle.id}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatLastUpdate(vehicle.lastUpdate)}
                      {vehicle.latitude && vehicle.longitude && (
                        <>
                          <MapPin className="h-3 w-3 ml-2" />
                          {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={getStatusVariant(vehicle.status)}>
                  {vehicle.status || 'Unknown'}
                </Badge>
              </div>
            ))}
            {vehicles.length > 10 && (
              <div className="text-center text-sm text-gray-500 pt-2">
                Showing 10 of {vehicles.length} vehicles
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VehicleListCard;