-- Create api_calls_monitor table for GPS51 API monitoring
CREATE TABLE public.api_calls_monitor (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  request_payload jsonb,
  response_status integer NOT NULL,
  response_body jsonb,
  duration_ms integer,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.api_calls_monitor ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view API call logs
CREATE POLICY "API call logs are viewable by authenticated users" 
ON public.api_calls_monitor 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy to allow system to insert API call logs
CREATE POLICY "System can insert API call logs" 
ON public.api_calls_monitor 
FOR INSERT 
WITH CHECK (true);

-- Add index for better performance on timestamp queries
CREATE INDEX idx_api_calls_monitor_timestamp ON public.api_calls_monitor(timestamp DESC);

-- Add index for status filtering
CREATE INDEX idx_api_calls_monitor_status ON public.api_calls_monitor(response_status);

-- Enable realtime for live updates
ALTER TABLE public.api_calls_monitor REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_calls_monitor;