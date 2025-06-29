
import { JobConfig } from '../types/cronJobTypes';

export const getJobConfig = (jobName: string): JobConfig => {
  const configs: Record<string, JobConfig> = {
    'gps51-sync-priority-1': { 
      name: 'Active/Moving Vehicles', 
      interval: '30 seconds', 
      color: 'destructive',
      priority: 1
    },
    'gps51-sync-priority-2': { 
      name: 'Assigned Vehicles', 
      interval: '2 minutes', 
      color: 'default',
      priority: 2
    },
    'gps51-sync-priority-3': { 
      name: 'Available Vehicles', 
      interval: '5 minutes', 
      color: 'secondary',
      priority: 3
    },
    'gps51-sync-priority-4': { 
      name: 'Inactive Vehicles', 
      interval: '15 minutes', 
      color: 'outline',
      priority: 4
    }
  };
  return configs[jobName] || { 
    name: jobName, 
    interval: 'Unknown', 
    color: 'default',
    priority: 0
  };
};

export const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s ago`;
  }
  return `${diffSecs}s ago`;
};
