/**
 * Fleet Metrics Cards
 * Displays key fleet statistics in card format
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Car, 
  Navigation, 
  Users, 
  TrendingUp, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface FleetMetrics {
  total: number;
  moving: number;
  stationary: number;
  offline: number;
  averageSpeed: number;
  utilization: number;
  lastUpdate: string;
}

interface FleetMetricsCardsProps {
  metrics: FleetMetrics;
}

const FleetMetricsCards: React.FC<FleetMetricsCardsProps> = ({ metrics }) => {
  const utilizationColor = metrics.utilization >= 70 ? 'text-green-600' : 
                          metrics.utilization >= 40 ? 'text-yellow-600' : 'text-red-600';

  const speedColor = metrics.averageSpeed >= 60 ? 'text-red-600' :
                    metrics.averageSpeed >= 30 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Fleet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Fleet</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.total}</div>
          <p className="text-xs text-muted-foreground">
            vehicles in fleet
          </p>
          
          {/* Vehicle status breakdown */}
          <div className="flex items-center space-x-4 mt-3 text-xs">
            <div className="flex items-center space-x-1">
              <Activity className="w-3 h-3 text-green-600" />
              <span>{metrics.moving} moving</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3 text-blue-600" />
              <span>{metrics.stationary} parked</span>
            </div>
            {metrics.offline > 0 && (
              <div className="flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>{metrics.offline} offline</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fleet Utilization */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${utilizationColor}`}>
            {metrics.utilization}%
          </div>
          <p className="text-xs text-muted-foreground">
            vehicles currently active
          </p>
          
          {/* Utilization progress bar */}
          <div className="mt-3">
            <Progress 
              value={metrics.utilization} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Speed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Speed</CardTitle>
          <Navigation className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${speedColor}`}>
            {metrics.averageSpeed}
          </div>
          <p className="text-xs text-muted-foreground">
            km/h fleet average
          </p>
          
          {/* Speed indicator */}
          <div className="mt-3">
            <Badge 
              variant={metrics.averageSpeed >= 60 ? 'destructive' : 
                      metrics.averageSpeed >= 30 ? 'outline' : 'secondary'}
              className="text-xs"
            >
              {metrics.averageSpeed >= 60 ? 'High Speed' :
               metrics.averageSpeed >= 30 ? 'Moderate' : 'Low Speed'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Status</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            Live
          </div>
          <p className="text-xs text-muted-foreground">
            last update: {metrics.lastUpdate}
          </p>
          
          {/* Status indicators */}
          <div className="flex items-center space-x-2 mt-3">
            <Badge variant="default" className="text-xs bg-green-100 text-green-700">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
              Connected
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FleetMetricsCards;