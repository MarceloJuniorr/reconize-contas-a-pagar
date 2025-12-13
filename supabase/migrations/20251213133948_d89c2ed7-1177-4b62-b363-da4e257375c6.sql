-- Fix profiles SELECT policy to restrict access to authorized roles only
-- Drop the existing policy that uses can_view_profile function
DROP POLICY IF EXISTS "Users can view accessible profiles" ON public.profiles;

-- Create a simpler, more restrictive policy
-- Only admin, operador, and pagador can view all profiles
-- Users can always view their own profile
CREATE POLICY "Authorized users can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'operador'::app_role) OR 
    has_role(auth.uid(), 'pagador'::app_role)
  );