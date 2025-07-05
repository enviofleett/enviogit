-- Ensure all required columns exist in gps51_sync_jobs table
-- Add missing columns if they don't exist
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'manual_sync';
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS positions_stored INTEGER DEFAULT 0;

-- Update any existing records that might have NULL values
UPDATE gps51_sync_jobs 
SET job_type = 'manual_sync' 
WHERE job_type IS NULL;

UPDATE gps51_sync_jobs 
SET status = 'pending' 
WHERE status IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_status ON gps51_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_job_type ON gps51_sync_jobs(job_type);