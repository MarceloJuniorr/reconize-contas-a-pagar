-- PHASE 1: CRITICAL SECURITY FIXES - Role-Based Access Control
-- Fix critical security vulnerabilities by implementing proper role-based access controls

-- 1. ACCOUNTS PAYABLE - Replace overly permissive policies
DROP POLICY "Authenticated users can view accounts" ON public.accounts_payable;
DROP POLICY "Users can create accounts" ON public.accounts_payable;

-- Create role-based policies for accounts_payable
CREATE POLICY "Authorized users can view accounts payable" 
ON public.accounts_payable 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'pagador'::app_role) OR 
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Authorized users can create accounts payable" 
ON public.accounts_payable 
FOR INSERT 
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'operador'::app_role)) AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update accounts payable" 
ON public.accounts_payable 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admins can delete accounts payable" 
ON public.accounts_payable 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. PAYMENTS - Replace overly permissive policies
DROP POLICY "Authenticated users can view payments" ON public.payments;

-- Create role-based policies for payments
CREATE POLICY "Authorized users can view payments" 
ON public.payments 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'pagador'::app_role) OR 
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Pagador and admin can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'pagador'::app_role)) AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Pagador and admin can update payments" 
ON public.payments 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'pagador'::app_role)
);

CREATE POLICY "Only admins can delete payments" 
ON public.payments 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. AUDIT LOGS - Restrict to admin only
DROP POLICY "Authenticated users can view audit logs" ON public.audit_logs;

CREATE POLICY "Only admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. ATTACHMENTS - Role-based access control
DROP POLICY "Authenticated users can view attachments" ON public.attachments;
DROP POLICY "Users can create attachments" ON public.attachments;

CREATE POLICY "Authorized users can view attachments" 
ON public.attachments 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'pagador'::app_role) OR 
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Authorized users can create attachments" 
ON public.attachments 
FOR INSERT 
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'operador'::app_role)) AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update attachments" 
ON public.attachments 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admins can delete attachments" 
ON public.attachments 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. COST CENTERS - Add missing policies for role-based access
CREATE POLICY "Authorized users can create cost centers" 
ON public.cost_centers 
FOR INSERT 
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR
   public.has_role(auth.uid(), 'operador'::app_role)) AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update cost centers" 
ON public.cost_centers 
FOR UPDATE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admins can delete cost centers" 
ON public.cost_centers 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'::app_role));