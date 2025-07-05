-- Create tables for the Developers monitoring section

-- Application logs table for centralized logging
CREATE TABLE public.app_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  level TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  source TEXT,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- API calls monitoring table for GPS51 API tracking
CREATE TABLE public.api_calls_monitor (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  request_payload JSONB DEFAULT '{}',
  response_status INTEGER,
  response_body JSONB DEFAULT '{}',
  duration_ms INTEGER,
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Edge function statistics and monitoring
CREATE TABLE public.edge_function_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  invocation_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  execution_duration_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_details JSONB DEFAULT '{}',
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  memory_usage_mb NUMERIC,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_calls_monitor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_function_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_logs (admin only access)
CREATE POLICY "admin_full_access_app_logs" 
ON public.app_logs 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = app_logs.organization_id
    AND role = 'admin'
  )
);

-- RLS policies for api_calls_monitor (admin only access)
CREATE POLICY "admin_full_access_api_calls_monitor" 
ON public.api_calls_monitor 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = api_calls_monitor.organization_id
    AND role = 'admin'
  )
);

-- RLS policies for edge_function_stats (admin only access)
CREATE POLICY "admin_full_access_edge_function_stats" 
ON public.edge_function_stats 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = edge_function_stats.organization_id
    AND role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX idx_app_logs_timestamp ON public.app_logs(timestamp DESC);
CREATE INDEX idx_app_logs_level ON public.app_logs(level);
CREATE INDEX idx_app_logs_organization ON public.app_logs(organization_id);

CREATE INDEX idx_api_calls_timestamp ON public.api_calls_monitor(timestamp DESC);
CREATE INDEX idx_api_calls_endpoint ON public.api_calls_monitor(endpoint);
CREATE INDEX idx_api_calls_status ON public.api_calls_monitor(response_status);
CREATE INDEX idx_api_calls_organization ON public.api_calls_monitor(organization_id);

CREATE INDEX idx_edge_stats_function ON public.edge_function_stats(function_name);
CREATE INDEX idx_edge_stats_timestamp ON public.edge_function_stats(invocation_time DESC);
CREATE INDEX idx_edge_stats_organization ON public.edge_function_stats(organization_id);

-- Enable realtime for live monitoring
ALTER TABLE public.app_logs REPLICA IDENTITY FULL;
ALTER TABLE public.api_calls_monitor REPLICA IDENTITY FULL;
ALTER TABLE public.edge_function_stats REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_calls_monitor;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edge_function_stats;