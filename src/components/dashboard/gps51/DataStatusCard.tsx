import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Database } from 'lucide-react';

interface DataStatusCardProps {
  metrics: any;
  liveData: any;
}

const DataStatusCard: React.FC<DataStatusCardProps> = ({ metrics, liveData }) => {
  const getConnectionStatus = () => {
    if (!metrics) return { icon: XCircle, text: 'Disconnected', variant: 'destructive' as const, color: 'text-red-600' };
    if ((metrics?.activeVehicles || 0) > 0) return { icon: CheckCircle, text: 'Connected', variant: 'default' as const, color: 'text-green-600' };
    return { icon: AlertCircle, text: 'Limited', variant: 'secondary' as const, color: 'text-yellow-600' };
  };

  const status = getConnectionStatus();
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          GPS51 Data Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <StatusIcon className={`h-6 w-6 ${status.color}`} />
            <div>
              <p className="text-sm text-slate-600">Connection</p>
              <Badge variant={status.variant} className="mt-1">
                {status.text}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <Database className="h-6 w-6 text-blue-600" />
            <div>
              <p className="text-sm text-slate-600">Data Quality</p>
              <Badge variant="outline" className="mt-1">
                {metrics ? 'Good' : 'No Data'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <CheckCircle className="h-6 w-6 text-purple-600" />
            <div>
              <p className="text-sm text-slate-600">System Status</p>
              <Badge variant="secondary" className="mt-1">
                Operational
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataStatusCard;