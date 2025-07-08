-- Fix RLS policies for referring_agents table
DROP POLICY IF EXISTS "Agents can view their own profile" ON public.referring_agents;
DROP POLICY IF EXISTS "Agents can update their own profile" ON public.referring_agents;
DROP POLICY IF EXISTS "Anyone can register as an agent" ON public.referring_agents;
DROP POLICY IF EXISTS "Admins can manage all agents" ON public.referring_agents;

-- Create new RLS policies that work properly
CREATE POLICY "Agents can view their referral data" 
ON public.referring_agents 
FOR SELECT 
USING (auth.uid()::text = user_id::text OR (auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Agents can update their own profile" 
ON public.referring_agents 
FOR UPDATE 
USING (auth.uid() = user_id OR (auth.jwt() ->> 'role'::text) = 'admin'::text);

CREATE POLICY "Users can register as agents" 
ON public.referring_agents 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all agents" 
ON public.referring_agents 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'admin'::text);