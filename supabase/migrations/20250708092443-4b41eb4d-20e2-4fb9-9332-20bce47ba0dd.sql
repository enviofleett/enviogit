-- Create referring_agents table for referral system
CREATE TABLE public.referring_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  agent_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  bank_account_details JSONB DEFAULT '{}',
  commission_rate NUMERIC DEFAULT 10.00,
  total_referrals INTEGER DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0.00,
  available_balance NUMERIC DEFAULT 0.00,
  pending_balance NUMERIC DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_referring_agents_agent_code ON public.referring_agents(agent_code);
CREATE INDEX idx_referring_agents_user_id ON public.referring_agents(user_id);

-- Enable Row Level Security
ALTER TABLE public.referring_agents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Agents can view their own profile" 
ON public.referring_agents 
FOR SELECT 
USING (auth.uid()::text = id::text);

CREATE POLICY "Agents can update their own profile" 
ON public.referring_agents 
FOR UPDATE 
USING (auth.uid()::text = id::text);

CREATE POLICY "Anyone can register as an agent" 
ON public.referring_agents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all agents" 
ON public.referring_agents 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_referring_agents_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_referring_agents_updated_at
BEFORE UPDATE ON public.referring_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_referring_agents_updated_at_column();