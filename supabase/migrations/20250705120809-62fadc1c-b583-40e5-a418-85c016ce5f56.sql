-- Additional role-based access policies for vehicle_positions table

-- Admin full access policy
CREATE POLICY "admin_full_access_vehicle_positions" 
ON public.vehicle_positions 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role = 'admin'
  )
);

-- Manager read access policy
CREATE POLICY "manager_read_vehicle_positions" 
ON public.vehicle_positions 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role IN ('admin', 'manager')
  )
);

-- Manager update access policy
CREATE POLICY "manager_update_vehicle_positions" 
ON public.vehicle_positions 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND organization_id = vehicle_positions.organization_id
    AND role IN ('admin', 'manager')
  )
);