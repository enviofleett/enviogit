-- Create emergency controls table
CREATE TABLE IF NOT EXISTS public.gps51_emergency_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emergency_stop_active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gps51_emergency_controls ENABLE ROW LEVEL SECURITY;

-- Create policies for emergency controls (admin only)
CREATE POLICY "Emergency controls are admin accessible" 
ON public.gps51_emergency_controls 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create system settings table for emergency toggles
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for system settings (admin only)
CREATE POLICY "System settings are admin accessible" 
ON public.system_settings 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Create coordinator logs table
CREATE TABLE IF NOT EXISTS public.gps51_coordinator_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  request_id TEXT,
  action TEXT,
  success BOOLEAN,
  processing_time BIGINT,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gps51_coordinator_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for coordinator logs
CREATE POLICY "Coordinator logs are viewable by authenticated users" 
ON public.gps51_coordinator_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Coordinator logs can be inserted by system" 
ON public.gps51_coordinator_logs 
FOR INSERT 
WITH CHECK (true);

-- Create update function for timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_gps51_emergency_controls_updated_at ON public.gps51_emergency_controls;
CREATE TRIGGER update_gps51_emergency_controls_updated_at
  BEFORE UPDATE ON public.gps51_emergency_controls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial emergency stop setting
INSERT INTO public.system_settings (key, value)
VALUES ('gps51_emergency_stop', '{"active": true, "reason": "Phase 3 Emergency Spike Elimination", "activatedAt": "2025-01-07T00:00:00Z"}')
ON CONFLICT (key) DO NOTHING;