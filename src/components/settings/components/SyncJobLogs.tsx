
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, AlertCircle, Clock } from 'lucide-react';
import { SyncJobLog } from '../types/cronJobTypes';

interface SyncJobLogsProps {
  logs: SyncJobLog[];
}

export const SyncJobLogs: React.FC<SyncJobLogsProps> = ({ logs }) => {
  if (logs.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="h-4 w-4" />
          Recent Sync Executions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={log.success ? 'default' : 'destructive'}>
                    P{log.priority}
                  </Badge>
                  {log.success ? (
                    <span className="text-green-600">✓</span>
                  ) : log.success === false ? (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  )}
                  <span>
                    {log.vehicles_processed} vehicles, {log.positions_stored} positions
                  </span>
                  {log.error_message && (
                    <span className="text-red-600 text-xs truncate max-w-[200px]">
                      {log.error_message}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {log.execution_time_seconds}s • {new Date(log.started_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
