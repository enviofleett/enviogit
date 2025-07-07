-- Create missing activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for activity_logs
CREATE POLICY "Users can view their own activity logs" 
ON public.activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view all activity logs" 
ON public.activity_logs 
FOR SELECT 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Create missing api_calls_monitor table if not exists and fix RLS
CREATE TABLE IF NOT EXISTS public.api_calls_monitor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  response_status INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS for api_calls_monitor
ALTER TABLE public.api_calls_monitor ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "System can insert API call logs" ON public.api_calls_monitor;
DROP POLICY IF EXISTS "Users can view API call logs" ON public.api_calls_monitor;
DROP POLICY IF EXISTS "Admins can view all API call logs" ON public.api_calls_monitor;

-- Create proper RLS policies for api_calls_monitor
CREATE POLICY "System can manage API call logs" 
ON public.api_calls_monitor 
FOR ALL 
USING (true);

CREATE POLICY "Users can view API call logs" 
ON public.api_calls_monitor 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

-- Create missing gps51_emergency_controls table if not exists
CREATE TABLE IF NOT EXISTS public.gps51_emergency_controls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emergency_stop_active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gps51_emergency_controls ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "System can manage emergency controls" 
ON public.gps51_emergency_controls 
FOR ALL 
USING (true);

-- Create missing gps51_coordinator_logs table if not exists
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

-- Enable RLS
ALTER TABLE public.gps51_coordinator_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "System can manage coordinator logs" 
ON public.gps51_coordinator_logs 
FOR ALL 
USING (true);

CREATE POLICY "Admins can view coordinator logs" 
ON public.gps51_coordinator_logs 
FOR SELECT 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_calls_monitor_timestamp ON public.api_calls_monitor(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_calls_monitor_endpoint ON public.api_calls_monitor(endpoint);
CREATE INDEX IF NOT EXISTS idx_gps51_coordinator_logs_timestamp ON public.gps51_coordinator_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_gps51_coordinator_logs_type ON public.gps51_coordinator_logs(type);