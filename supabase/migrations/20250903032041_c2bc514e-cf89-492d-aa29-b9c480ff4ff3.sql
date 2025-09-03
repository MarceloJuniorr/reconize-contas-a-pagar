-- CRITICAL SECURITY FIX: Restrict Supplier Data Access
-- Fix security vulnerability where sensitive supplier information is exposed to all authenticated users
-- This includes contact details, addresses, documents, and bank account information

-- 1. Drop the overly permissive policy that allows all authenticated users to view suppliers
DROP POLICY "Authenticated users can view suppliers" ON public.suppliers;

-- 2. Create role-based policies for suppliers table
-- Only admin, operador, and pagador roles should have access to supplier data
CREATE POLICY "Authorized users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'pagador'::app_role) OR 
  public.has_role(auth.uid(), 'operador'::app_role)
);

-- 3. Add missing INSERT policy - only admin and operador can create suppliers
CREATE POLICY "Authorized users can create suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'operador'::app_role)) AND
  auth.uid() IS NOT NULL
);

-- 4. Add missing UPDATE policy - only admin and operador can update suppliers
CREATE POLICY "Authorized users can update suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role)
);

-- 5. Add missing DELETE policy - only admins can delete suppliers
CREATE POLICY "Only admins can delete suppliers" 
ON public.suppliers 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));