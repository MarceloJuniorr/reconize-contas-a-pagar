-- Drop existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Revoke all access from anon role to ensure unauthenticated users cannot access
REVOKE ALL ON public.profiles FROM anon;

-- Grant access only to authenticated role
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Create strict SELECT policy - only authenticated users can access
-- Users can view their own profile OR admins can view all
CREATE POLICY "Authenticated users can view own profile or admins view all" 
ON public.profiles
FOR SELECT 
TO authenticated
USING (
  auth.uid() = id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create UPDATE policy - users can only update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);