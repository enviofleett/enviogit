-- Add missing columns to gps51_sync_jobs table
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 2;
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS positions_stored INTEGER DEFAULT 0;