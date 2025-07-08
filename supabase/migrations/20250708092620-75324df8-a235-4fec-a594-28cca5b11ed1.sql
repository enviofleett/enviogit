-- Fix RLS policies for referring_agents table with correct column structure
DROP POLICY IF EXISTS "Agents can view their referral data" ON public.referring_agents;
DROP POLICY IF EXISTS "Agents can update their own profile" ON public.referring_agents;
DROP POLICY IF EXISTS "Users can register as agents" ON public.referring_agents;
DROP POLICY IF EXISTS "Admins can manage all agents" ON public.referring_agents;

-- Create RLS policies that work with the actual table structure
CREATE POLICY "Agents can view their own data" 
ON public.referring_agents 
FOR SELECT 
USING (auth.uid()::text = id::text OR (auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Agents can update their own profile" 
ON public.referring_agents 
FOR UPDATE 
USING (auth.uid()::text = id::text OR (auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "System can manage agents" 
ON public.referring_agents 
FOR ALL 
USING (true);

-- Also ensure the table has RLS enabled
ALTER TABLE public.referring_agents ENABLE ROW LEVEL SECURITY;