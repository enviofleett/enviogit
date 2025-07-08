
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { EnhancedFleetMetrics } from '@/hooks/useGPS51FleetMetrics';
// Using simple interface instead of deleted service
interface LiveDataState {
  lastQueryPositionTime: number;
}

interface DataStatusCardProps {
  metrics: EnhancedFleetMetrics;
  liveData: LiveDataState;
}

const DataStatusCard: React.FC<DataStatusCardProps> = ({ metrics, liveData }) => {
  const getStatusBadge = (freshness: string) => {
    switch (freshness) {
      case 'live':
        return <Badge className="bg-green-100 text-green-800">Live</Badge>;
      case 'stale':
        return <Badge className="bg-yellow-100 text-yellow-800">Stale</Badge>;
      case 'offline':
        return <Badge variant="secondary">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatLastUpdate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Live Data Status
          </span>
          {getStatusBadge(metrics.dataFreshness)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Last Update:</span>
            <p className="font-medium">{formatLastUpdate(metrics.lastUpdateTime)}</p>
          </div>
          <div>
            <span className="text-gray-600">Avg Speed:</span>
            <p className="font-medium">{metrics.averageSpeed} km/h</p>
          </div>
          <div>
            <span className="text-gray-600">Total Distance:</span>
            <p className="font-medium">{metrics.totalDistance} km</p>
          </div>
          <div>
            <span className="text-gray-600">Query Time:</span>
            <p className="font-medium">{liveData.lastQueryPositionTime}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataStatusCard;
