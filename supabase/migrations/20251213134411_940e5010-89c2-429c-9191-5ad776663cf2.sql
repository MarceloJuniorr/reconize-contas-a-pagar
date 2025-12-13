-- Fix profiles SELECT policy - restrict to self and admins only
-- But create a helper function to get user names for audit display
DROP POLICY IF EXISTS "Authorized users can view profiles" ON public.profiles;

-- Strict policy: only view own profile or be admin
CREATE POLICY "Users can view own profile or admins view all" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Create a security definer function to get user name by id
-- This allows displaying names in audit trails without exposing email
CREATE OR REPLACE FUNCTION public.get_user_display_name(_user_id uuid)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.id = _user_id
$$;