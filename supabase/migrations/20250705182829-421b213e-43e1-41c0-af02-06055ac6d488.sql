-- Add missing columns to vehicles table that GPS51 system expects
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS license_plate TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps51_device_id TEXT;

-- Update existing plate column to license_plate for consistency
UPDATE vehicles SET license_plate = plate WHERE license_plate IS NULL;

-- Create vehicle_positions table for GPS51 data
CREATE TABLE IF NOT EXISTS vehicle_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude DECIMAL(8, 2),
  speed DECIMAL(6, 2),
  heading DECIMAL(6, 2),
  accuracy DECIMAL(6, 2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  battery_level INTEGER,
  fuel_level DECIMAL(5, 2),
  temperature DECIMAL(5, 2),
  odometer DECIMAL(12, 2),
  engine_hours DECIMAL(10, 2),
  status TEXT DEFAULT 'active',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE vehicle_positions ENABLE ROW LEVEL SECURITY;

-- Vehicle positions are viewable by authenticated users
CREATE POLICY "Vehicle positions are viewable by authenticated users" 
ON vehicle_positions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- System can insert vehicle positions
CREATE POLICY "System can insert vehicle positions" 
ON vehicle_positions 
FOR INSERT 
WITH CHECK (true);

-- System can update vehicle positions
CREATE POLICY "System can update vehicle positions" 
ON vehicle_positions 
FOR UPDATE 
USING (true);

-- Create gps51_sync_jobs table for GPS51 sync management
CREATE TABLE IF NOT EXISTS gps51_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL CHECK (job_type IN ('full_sync', 'incremental_sync', 'device_sync', 'position_sync')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  sync_parameters JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  vehicles_processed INTEGER DEFAULT 0,
  positions_processed INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE gps51_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Sync jobs are viewable by authenticated users
CREATE POLICY "GPS51 sync jobs are viewable by authenticated users" 
ON gps51_sync_jobs 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- System can manage sync jobs
CREATE POLICY "System can manage GPS51 sync jobs" 
ON gps51_sync_jobs 
FOR ALL
USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_vehicle_id ON vehicle_positions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_device_id ON vehicle_positions(device_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_timestamp ON vehicle_positions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vehicles_gps51_device_id ON vehicles(gps51_device_id);
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_status ON gps51_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_gps51_sync_jobs_created_at ON gps51_sync_jobs(created_at DESC);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_vehicle_positions_updated_at
  BEFORE UPDATE ON vehicle_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_gps51_sync_jobs_updated_at
  BEFORE UPDATE ON gps51_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_updated_at_column();