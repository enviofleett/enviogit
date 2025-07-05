-- Add missing columns to vehicle_positions table
ALTER TABLE vehicle_positions ADD COLUMN IF NOT EXISTS ignition_status BOOLEAN DEFAULT false;
ALTER TABLE vehicle_positions ADD COLUMN IF NOT EXISTS engine_temperature DECIMAL(5, 2);

-- Add missing columns to gps51_sync_jobs table  
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT false;
ALTER TABLE gps51_sync_jobs ADD COLUMN IF NOT EXISTS execution_time_seconds INTEGER;

-- Create generic function for timestamp updates if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers to use the generic function
DROP TRIGGER IF EXISTS update_vehicle_positions_updated_at ON vehicle_positions;
CREATE TRIGGER update_vehicle_positions_updated_at
  BEFORE UPDATE ON vehicle_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gps51_sync_jobs_updated_at ON gps51_sync_jobs;
CREATE TRIGGER update_gps51_sync_jobs_updated_at
  BEFORE UPDATE ON gps51_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();