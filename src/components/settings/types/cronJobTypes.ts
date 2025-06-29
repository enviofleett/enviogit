
export interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  next_run: string | null;
}

export interface SyncJobLog {
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

export interface JobConfig {
  name: string;
  interval: string;
  color: 'destructive' | 'default' | 'secondary' | 'outline';
  priority: number;
}
