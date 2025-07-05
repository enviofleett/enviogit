-- Additional RLS policies for vehicle_positions table
-- Organization isolation policy for vehicle_positions
CREATE POLICY "org_isolation_vehicle_positions" 
ON public.vehicle_positions 
FOR ALL 
TO authenticated
USING (organization_id = public.get_user_organization_id());

-- Role-based access policies
CREATE POLICY "admin_full_access_vehicle_positions" 
ON public.vehicle_positions 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role IN ('admin', 'owner')
  )
);

-- Manager read access
CREATE POLICY "manager_read_vehicle_positions" 
ON public.vehicle_positions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role IN ('admin', 'owner', 'manager')
  )
);

-- Manager update access
CREATE POLICY "manager_update_vehicle_positions" 
ON public.vehicle_positions 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role IN ('admin', 'owner', 'manager')
  )
);