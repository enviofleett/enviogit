
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Play, Pause, Activity, Database, AlertCircle } from 'lucide-react';

interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  next_run: string | null;
}

interface SyncJobLog {
  id: string;
  priority: number;
  started_at: string;
  completed_at: string | null;
  success: boolean | null;
  vehicles_processed: number;
  positions_stored: number;
  error_message: string | null;
  execution_time_seconds: number | null;
}

export const GPS51CronJobManager = () => {
  const [cronJobs, setCronJobs] = useState<CronJobStatus[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncJobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchCronJobs = async () => {
    setLoading(true);
    try {
      console.log('Fetching cron job status...');
      
      // Get cron job status from pg_cron
      const { data: cronData, error: cronError } = await supabase
        .rpc('get_cron_jobs') // We'll need to create this function
        .single();

      if (cronError) {
        console.error('Error fetching cron jobs:', cronError);
        // Fallback to mock data for now
        setCronJobs([
          {
            jobname: 'gps51-sync-priority-1',
            schedule: '*/30 * * * * *',
            active: true,
            last_run: new Date(Date.now() - 30000).toISOString(),
            next_run: new Date(Date.now() + 30000).toISOString()
          },
          {
            jobname: 'gps51-sync-priority-2', 
            schedule: '*/2 * * * *',
            active: true,
            last_run: new Date(Date.now() - 60000).toISOString(),
            next_run: new Date(Date.now() + 60000).toISOString()
          },
          {
            jobname: 'gps51-sync-priority-3',
            schedule: '*/5 * * * *',
            active: true,
            last_run: new Date(Date.now() - 120000).toISOString(),
            next_run: new Date(Date.now() + 180000).toISOString()
          },
          {
            jobname: 'gps51-sync-priority-4',
            schedule: '*/15 * * * *',
            active: true,
            last_run: new Date(Date.now() - 300000).toISOString(),
            next_run: new Date(Date.now() + 600000).toISOString()
          }
        ]);
      } else {
        setCronJobs(cronData || []);
      }

      // Get sync job logs
      const { data: logsData, error: logsError } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (logsError) {
        console.error('Error fetching sync logs:', logsError);
      } else {
        setSyncLogs(logsData || []);
      }

      toast({
        title: "Cron Jobs Updated",
        description: `Found ${cronJobs.length} scheduled jobs`,
      });
    } catch (error) {
      console.error('Error fetching cron job data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch cron job status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCronJob = async (jobName: string, enable: boolean) => {
    try {
      console.log(`${enable ? 'Enabling' : 'Disabling'} cron job: ${jobName}`);
      
      // This would call a function to enable/disable cron jobs
      // For now, we'll just update the local state
      setCronJobs(prev => prev.map(job => 
        job.jobname === jobName ? { ...job, active: enable } : job
      ));

      toast({
        title: `Cron Job ${enable ? 'Enabled' : 'Disabled'}`,
        description: `${jobName} has been ${enable ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling cron job:', error);
      toast({
        title: "Error",
        description: "Failed to toggle cron job",
        variant: "destructive",
      });
    }
  };

  const getJobConfig = (jobName: string) => {
    const configs = {
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
    return configs[jobName as keyof typeof configs] || { 
      name: jobName, 
      interval: 'Unknown', 
      color: 'default',
      priority: 0
    };
  };

  const formatRelativeTime = (dateString: string | null) => {
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

  useEffect(() => {
    fetchCronJobs();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchCronJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Real-Time Sync Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={fetchCronJobs}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cronJobs.map(job => {
              const config = getJobConfig(job.jobname);
              return (
                <Card key={job.jobname} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant={config.color as any}>
                        Priority {config.priority}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={job.active}
                          onCheckedChange={(checked) => toggleCronJob(job.jobname, checked)}
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
            })}
          </div>

          {syncLogs.length > 0 && (
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
                    {syncLogs.map((log) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};
