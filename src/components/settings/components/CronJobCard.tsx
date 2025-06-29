
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Play, Pause } from 'lucide-react';
import { CronJobStatus } from '../types/cronJobTypes';
import { getJobConfig, formatRelativeTime } from '../utils/cronJobUtils';

interface CronJobCardProps {
  job: CronJobStatus;
  onToggle: (jobName: string, enable: boolean) => void;
}

export const CronJobCard: React.FC<CronJobCardProps> = ({ job, onToggle }) => {
  const config = getJobConfig(job.jobname);

  return (
    <Card className="border-2">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={config.color as any}>
            Priority {config.priority}
          </Badge>
          <div className="flex items-center gap-2">
            <Switch
              checked={job.active}
              onCheckedChange={(checked) => onToggle(job.jobname, checked)}
            />
            {job.active ? (
              <Play className="h-4 w-4 text-green-600" />
            ) : (
              <Pause className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm font-medium">{config.name}</div>
          <div className="text-xs text-gray-500">
            Every {config.interval}
          </div>
          <div className="text-xs">
            <div>Last run: {formatRelativeTime(job.last_run)}</div>
            <div>Next run: {formatRelativeTime(job.next_run)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
