-- Create table for map service settings
CREATE TABLE public.map_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_provider TEXT NOT NULL DEFAULT 'maptiler',
  api_key TEXT,
  default_style TEXT DEFAULT 'streets',
  zoom_level INTEGER DEFAULT 10,
  center_lat NUMERIC DEFAULT 6.5244,
  center_lng NUMERIC DEFAULT 3.3792,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_service_provider CHECK (service_provider IN ('maptiler', 'mapbox', 'openstreetmap'))
);

-- Enable RLS
ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;

-- Users can manage their own map settings
CREATE POLICY "Users can manage their own map settings"
ON public.map_settings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_map_settings_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_map_settings_updated_at
BEFORE UPDATE ON public.map_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_map_settings_updated_at_column();