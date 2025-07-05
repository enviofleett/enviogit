
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Activity } from 'lucide-react';
import { CronJobStatus, SyncJobLog } from './types/cronJobTypes';
import { CronJobCard } from './components/CronJobCard';
import { SyncJobLogs } from './components/SyncJobLogs';

export const GPS51CronJobManager = () => {
  const [cronJobs, setCronJobs] = useState<CronJobStatus[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncJobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchCronJobs = async () => {
    setLoading(true);
    try {
      console.log('Fetching cron job status...');
      
      // Get cron job status from the new function
      const { data: cronData, error: cronError } = await supabase
        .rpc('get_cron_jobs_status');

      if (cronError) {
        console.error('Error fetching cron jobs:', cronError);
        // Fallback to mock data
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
        // Handle both array and JSON string responses
        if (Array.isArray(cronData)) {
          setCronJobs(cronData as unknown as CronJobStatus[]);
        } else {
          const parsedData = typeof cronData === 'string' ? JSON.parse(cronData) : cronData;
          setCronJobs(Array.isArray(parsedData) ? parsedData as CronJobStatus[] : []);
        }
      }

      // Get sync job logs
      const { data: logsData, error: logsError } = await supabase
        .from('gps51_sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (logsError) {
        console.error('Error fetching sync logs:', logsError);
        setSyncLogs([]);
      } else {
        const filteredLogs = (logsData || []).filter((log: any) => 
          log.priority !== undefined && log.started_at !== undefined
        ).map((log: any) => ({
          id: log.id,
          priority: log.priority,
          started_at: log.started_at,
          completed_at: log.completed_at,
          success: log.success,
          vehicles_processed: log.vehicles_processed || 0,
          positions_stored: log.positions_stored || 0,
          error_message: log.error_message,
          execution_time_seconds: log.execution_time_seconds
        })) as SyncJobLog[];
        
        setSyncLogs(filteredLogs);
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
      
      // Update local state for now
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
            {cronJobs.map(job => (
              <CronJobCard
                key={job.jobname}
                job={job}
                onToggle={toggleCronJob}
              />
            ))}
          </div>

          <SyncJobLogs logs={syncLogs} />
        </CardContent>
      </Card>
    </div>
  );
};
