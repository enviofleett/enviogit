-- Phase 1: Fix RLS policy for gps51_sync_jobs to allow system operations
DROP POLICY IF EXISTS "Allow read access to sync jobs" ON public.gps51_sync_jobs;

-- Allow authenticated users to read sync jobs
CREATE POLICY "Allow read access to sync jobs" 
ON public.gps51_sync_jobs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Allow system operations to insert sync jobs (service role and authenticated users)
CREATE POLICY "Allow insert sync jobs" 
ON public.gps51_sync_jobs 
FOR INSERT 
WITH CHECK (true);

-- Allow system operations to update sync jobs
CREATE POLICY "Allow update sync jobs" 
ON public.gps51_sync_jobs 
FOR UPDATE 
USING (true);