
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron jobs for GPS51 sync with different priorities
-- High priority vehicles (active/moving) - every 30 seconds
SELECT cron.schedule(
  'gps51-sync-priority-1',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M"}'::jsonb,
    body := '{"priority": 1, "batchMode": true, "apiUrl": "", "username": "", "password": ""}'::jsonb
  );
  $$
);

-- Medium priority vehicles (assigned) - every 2 minutes
SELECT cron.schedule(
  'gps51-sync-priority-2',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M"}'::jsonb,
    body := '{"priority": 2, "batchMode": true, "apiUrl": "", "username": "", "password": ""}'::jsonb
  );
  $$
);

-- Low priority vehicles (available) - every 5 minutes
SELECT cron.schedule(
  'gps51-sync-priority-3',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M"}'::jsonb,
    body := '{"priority": 3, "batchMode": true, "apiUrl": "", "username": "", "password": ""}'::jsonb
  );
  $$
);

-- Very low priority vehicles (inactive) - every 15 minutes
SELECT cron.schedule(
  'gps51-sync-priority-4',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/gps51-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M"}'::jsonb,
    body := '{"priority": 4, "batchMode": true, "apiUrl": "", "username": "", "password": ""}'::jsonb
  );
  $$
);

-- Create a table to track cron job execution
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
