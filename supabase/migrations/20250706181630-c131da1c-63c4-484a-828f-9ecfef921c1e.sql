-- Phase 1: Fix JWT Role Integration
-- Create custom claims function to update JWT with user role
CREATE OR REPLACE FUNCTION public.set_custom_claims(user_id uuid, claims jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users 
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || claims
  WHERE id = user_id;
END;
$$;

-- Create function to update JWT claims when role changes
CREATE OR REPLACE FUNCTION public.update_user_jwt_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update JWT claims with the user's role
  PERFORM public.set_custom_claims(NEW.id, jsonb_build_object('role', NEW.role));
  RETURN NEW;
END;
$$;

-- Update the existing handle_new_user function to set JWT claims
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  -- Insert a corresponding row into public.profiles
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'), 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    'active'
  );
  
  -- Set JWT claims with the user's role
  PERFORM public.set_custom_claims(NEW.id, jsonb_build_object('role', COALESCE(NEW.raw_user_meta_data->>'role', 'user')));
  
  RETURN NEW;
END;
$$;

-- Create trigger to update JWT claims when profile role changes
CREATE TRIGGER update_jwt_claims_on_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.update_user_jwt_claims();

-- Phase 2: Set up Super Admin Account
-- First, let's create a function to promote a user to admin
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
BEGIN
  -- Find the user by email
  SELECT au.id, p.id as profile_id
  INTO user_record
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE au.email = user_email;
  
  IF user_record.id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Update profile role to admin
  UPDATE public.profiles 
  SET role = 'admin', updated_at = now()
  WHERE id = user_record.id;
  
  -- Update JWT claims
  PERFORM public.set_custom_claims(user_record.id, jsonb_build_object('role', 'admin'));
  
  -- Log the action
  INSERT INTO public.activity_logs (user_id, activity_type, description, metadata)
  VALUES (
    user_record.id,
    'role_change',
    'User promoted to admin',
    jsonb_build_object('previous_role', 'user', 'new_role', 'admin', 'promoted_by', 'system')
  );
END;
$$;

-- Phase 3: Create admin management functions
CREATE OR REPLACE FUNCTION public.change_user_role(target_user_id uuid, new_role text, admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_role text;
  admin_role text;
BEGIN
  -- Check if the requesting user is an admin
  SELECT role INTO admin_role FROM public.profiles WHERE id = admin_user_id;
  
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  -- Get old role for logging
  SELECT role INTO old_role FROM public.profiles WHERE id = target_user_id;
  
  -- Update the user's role
  UPDATE public.profiles 
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
  
  -- Update JWT claims
  PERFORM public.set_custom_claims(target_user_id, jsonb_build_object('role', new_role));
  
  -- Log the action
  INSERT INTO public.activity_logs (user_id, activity_type, description, metadata)
  VALUES (
    target_user_id,
    'role_change',
    'User role changed by admin',
    jsonb_build_object('previous_role', old_role, 'new_role', new_role, 'changed_by', admin_user_id)
  );
END;
$$;