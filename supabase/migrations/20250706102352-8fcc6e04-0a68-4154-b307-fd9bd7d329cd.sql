-- Fix missing job_type column in gps51_sync_jobs table
ALTER TABLE public.gps51_sync_jobs 
ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'live_data_sync';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_job_type ON public.gps51_sync_jobs(job_type);

-- Update existing records to have proper job_type
UPDATE public.gps51_sync_jobs 
SET job_type = 'live_data_sync' 
WHERE job_type IS NULL OR job_type = '';

-- Ensure all required columns exist
ALTER TABLE public.gps51_sync_jobs 
ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS positions_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS positions_stored INTEGER DEFAULT 0;