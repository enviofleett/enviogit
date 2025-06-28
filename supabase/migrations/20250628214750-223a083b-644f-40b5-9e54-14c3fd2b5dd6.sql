
-- Create table for storing GPS position data from GPS51 API
CREATE TABLE public.vehicle_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(8, 2) NOT NULL DEFAULT 0,
  heading DECIMAL(5, 2) NOT NULL DEFAULT 0,
  altitude DECIMAL(8, 2) DEFAULT 0,
  accuracy DECIMAL(8, 2) DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  address TEXT,
  ignition_status BOOLEAN NOT NULL DEFAULT false,
  fuel_level DECIMAL(5, 2),
  engine_temperature DECIMAL(5, 2),
  battery_level DECIMAL(5, 2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_vehicle_positions_vehicle_id ON public.vehicle_positions(vehicle_id);
CREATE INDEX idx_vehicle_positions_timestamp ON public.vehicle_positions(timestamp DESC);
CREATE INDEX idx_vehicle_positions_recorded_at ON public.vehicle_positions(recorded_at DESC);

-- Create a composite index for latest position queries
CREATE INDEX idx_vehicle_positions_vehicle_timestamp ON public.vehicle_positions(vehicle_id, timestamp DESC);

-- Enable Row Level Security (RLS) if needed
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow reading vehicle positions (adjust as needed for your auth requirements)
CREATE POLICY "Allow read access to vehicle positions" ON public.vehicle_positions
FOR SELECT USING (true);

-- Create a policy to allow inserting vehicle positions (for the sync function)
CREATE POLICY "Allow insert access to vehicle positions" ON public.vehicle_positions
FOR INSERT WITH CHECK (true);

-- Enable realtime for the vehicle_positions table
ALTER TABLE public.vehicle_positions REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.vehicle_positions;
