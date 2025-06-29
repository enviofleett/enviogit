
-- Add a unique constraint to the gps51_device_id column to enable upsert operations
-- This will allow the Edge Function to properly identify existing vehicles by their GPS51 device ID
ALTER TABLE public.vehicles 
ADD CONSTRAINT vehicles_gps51_device_id_unique 
UNIQUE (gps51_device_id);

-- Also create an index for better query performance on this frequently accessed column
CREATE INDEX IF NOT EXISTS idx_vehicles_gps51_device_id_lookup ON public.vehicles(gps51_device_id) WHERE gps51_device_id IS NOT NULL;
