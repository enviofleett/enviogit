
-- Add GPS51 device ID column to vehicles table for proper mapping
ALTER TABLE public.vehicles ADD COLUMN gps51_device_id TEXT;

-- Create index for better performance when matching GPS51 positions
CREATE INDEX IF NOT EXISTS idx_vehicles_gps51_device_id ON public.vehicles(gps51_device_id);

-- Update the unique constraint to include GPS51 device ID as an alternative identifier
-- This allows us to find vehicles by either license plate or GPS51 device ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_gps51_device_id_unique ON public.vehicles(gps51_device_id) WHERE gps51_device_id IS NOT NULL;
