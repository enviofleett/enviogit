-- Create organizations table for multi-tenant architecture
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_tier TEXT DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add organization_id to existing tables where missing
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.vehicle_positions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.geofences 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to profiles for tenant association
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Enable RLS on critical tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Organization isolation policies
CREATE POLICY "org_isolation_organizations" 
ON public.organizations 
FOR ALL 
TO authenticated
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "org_isolation_vehicles" 
ON public.vehicles 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "org_isolation_vehicle_positions" 
ON public.vehicle_positions 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "org_isolation_geofences" 
ON public.geofences 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "org_isolation_alerts" 
ON public.alerts 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

-- Service role policies for GPS51 integration
CREATE POLICY "service_gps_data_insert" 
ON public.vehicle_positions 
FOR INSERT 
TO service_role
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE id = vehicle_positions.vehicle_id
    AND organization_id = vehicle_positions.organization_id
  )
);

-- Create RLS audit logging table
CREATE TABLE IF NOT EXISTS public.rls_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  policy_name TEXT,
  action TEXT NOT NULL,
  user_id UUID,
  organization_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rls_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_logs" 
ON public.rls_audit_logs 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);