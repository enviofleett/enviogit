-- Create synthetic_test_runs table
CREATE TABLE public.synthetic_test_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_scenarios INTEGER NOT NULL DEFAULT 0,
  passed_scenarios INTEGER NOT NULL DEFAULT 0,
  failed_scenarios INTEGER NOT NULL DEFAULT 0,
  skipped_scenarios INTEGER NOT NULL DEFAULT 0,
  execution_time_ms INTEGER,
  triggered_by UUID,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  run_type TEXT NOT NULL DEFAULT 'scheduled',
  environment TEXT NOT NULL DEFAULT 'test',
  status TEXT NOT NULL DEFAULT 'running',
  error_summary TEXT
);

-- Enable Row Level Security
ALTER TABLE public.synthetic_test_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage test runs" 
ON public.synthetic_test_runs 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "System can create test runs" 
ON public.synthetic_test_runs 
FOR INSERT 
WITH CHECK (true);