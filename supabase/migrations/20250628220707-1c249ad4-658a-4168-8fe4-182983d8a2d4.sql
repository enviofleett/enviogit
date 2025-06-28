
-- Create vehicle_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('available', 'inactive', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- The vehicles table already exists from the previous migration, so we don't need to recreate it
-- Just make sure it has the right indexes and policies

-- Create indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON public.vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON public.vehicles(type);

-- Enable Row Level Security if not already enabled
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist (using IF NOT EXISTS equivalent)
DROP POLICY IF EXISTS "Allow read access to vehicles" ON public.vehicles;
CREATE POLICY "Allow read access to vehicles" ON public.vehicles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert access to vehicles" ON public.vehicles;
CREATE POLICY "Allow insert access to vehicles" ON public.vehicles
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access to vehicles" ON public.vehicles;
CREATE POLICY "Allow update access to vehicles" ON public.vehicles
FOR UPDATE USING (true);

-- Enable realtime for the vehicles table
ALTER TABLE public.vehicles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
