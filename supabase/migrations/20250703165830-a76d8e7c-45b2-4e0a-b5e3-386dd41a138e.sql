-- Create geofences table
CREATE TABLE public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('circular', 'polygon')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  alert_on_entry BOOLEAN NOT NULL DEFAULT false,
  alert_on_exit BOOLEAN NOT NULL DEFAULT false,
  alert_on_violation BOOLEAN NOT NULL DEFAULT false,
  center_lat DECIMAL,
  center_lng DECIMAL,
  radius INTEGER, -- in meters
  coordinates JSONB, -- array of {lat, lng} for polygon
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  tags TEXT[],
  schedules JSONB
);

-- Create geofence_events table
CREATE TABLE public.geofence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('entry', 'exit', 'violation')),
  geofence_id UUID NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  location JSONB NOT NULL, -- {lat, lng}
  speed DECIMAL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for geofences
CREATE POLICY "Users can view active geofences" ON public.geofences
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can manage geofences" ON public.geofences
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Create RLS policies for geofence_events
CREATE POLICY "Users can view geofence events" ON public.geofence_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can insert geofence events" ON public.geofence_events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_geofences_active ON public.geofences(is_active);
CREATE INDEX idx_geofences_type ON public.geofences(type);
CREATE INDEX idx_geofence_events_geofence_id ON public.geofence_events(geofence_id);
CREATE INDEX idx_geofence_events_vehicle_id ON public.geofence_events(vehicle_id);
CREATE INDEX idx_geofence_events_timestamp ON public.geofence_events(timestamp);
CREATE INDEX idx_geofence_events_type ON public.geofence_events(type);

-- Create trigger for updated_at
CREATE TRIGGER update_geofences_updated_at
  BEFORE UPDATE ON public.geofences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();