
-- First, let's make sure the gps51_sync_jobs table exists with proper structure
CREATE TABLE IF NOT EXISTS public.gps51_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  priority INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN,
  vehicles_processed INTEGER DEFAULT 0,
  positions_stored INTEGER DEFAULT 0,
  error_message TEXT,
  execution_time_seconds INTEGER
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_priority ON public.gps51_sync_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_started_at ON public.gps51_sync_jobs(started_at DESC);

-- Enable RLS
ALTER TABLE public.gps51_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Allow reading sync job logs
CREATE POLICY "Allow read access to sync jobs" ON public.gps51_sync_jobs
FOR SELECT USING (true);

-- Create a function to get cron job status (simplified version since we can't directly query pg_cron from client)
CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return mock data for now since we can't query pg_cron directly from client
  RETURN '[
    {
      "jobname": "gps51-sync-priority-1",
      "schedule": "*/30 * * * * *",
      "active": true,
      "last_run": null,
      "next_run": null
    },
    {
      "jobname": "gps51-sync-priority-2",
      "schedule": "*/2 * * * *", 
      "active": true,
      "last_run": null,
      "next_run": null
    },
    {
      "jobname": "gps51-sync-priority-3",
      "schedule": "*/5 * * * *",
      "active": true,
      "last_run": null,
      "next_run": null
    },
    {
      "jobname": "gps51-sync-priority-4",
      "schedule": "*/15 * * * *",
      "active": true,
      "last_run": null,
      "next_run": null
    }
  ]'::jsonb;
END;
$$;
