-- Create activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on activity_logs if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activity_logs' AND policyname = 'System can insert activity logs'
  ) THEN
    ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "System can insert activity logs" 
    ON public.activity_logs 
    FOR INSERT 
    WITH CHECK (true);
  END IF;
END $$;

-- Create gps51_emergency_controls table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.gps51_emergency_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emergency_stop_active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gps51_emergency_controls' AND policyname = 'System can manage emergency controls'
  ) THEN
    ALTER TABLE public.gps51_emergency_controls ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "System can manage emergency controls" 
    ON public.gps51_emergency_controls 
    FOR ALL 
    USING (true);
  END IF;
END $$;

-- Create gps51_coordinator_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.gps51_coordinator_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  request_id TEXT,
  action TEXT,
  success BOOLEAN,
  error TEXT,
  processing_time INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cooldown_until TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS and create policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gps51_coordinator_logs' AND policyname = 'System can manage coordinator logs'
  ) THEN
    ALTER TABLE public.gps51_coordinator_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "System can manage coordinator logs" 
    ON public.gps51_coordinator_logs 
    FOR ALL 
    USING (true);
  END IF;
END $$;