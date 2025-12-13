-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a function to check if a user can view a specific profile
-- This allows viewing profiles that are linked to accessible records
CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin can view all
    public.has_role(_viewer_id, 'admin'::app_role)
    -- User can view their own profile
    OR _viewer_id = _profile_id
    -- User can view profiles linked to accounts_payable they can access
    OR EXISTS (
      SELECT 1 FROM public.accounts_payable ap
      WHERE ap.created_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'pagador'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role))
    )
    -- User can view profiles linked to payments they can access
    OR EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.paid_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'pagador'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role))
    )
    -- User can view profiles linked to sales they can access
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE (s.created_by = _profile_id OR s.cancelled_by = _profile_id)
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.user_has_store_access(_viewer_id, s.store_id))
    )
    -- User can view profiles linked to stock movements they can access
    OR EXISTS (
      SELECT 1 FROM public.stock_movements sm
      WHERE sm.created_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.user_has_store_access(_viewer_id, sm.store_id))
    )
    -- User can view profiles linked to stock receipt headers they can access
    OR EXISTS (
      SELECT 1 FROM public.stock_receipt_headers srh
      WHERE (srh.received_by = _profile_id OR srh.cancelled_by = _profile_id)
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.user_has_store_access(_viewer_id, srh.store_id))
    )
    -- User can view profiles linked to cash register closings they can access
    OR EXISTS (
      SELECT 1 FROM public.cash_register_closings crc
      WHERE (crc.opened_by = _profile_id OR crc.closed_by = _profile_id)
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.user_has_store_access(_viewer_id, crc.store_id))
    )
    -- User can view profiles linked to cash register movements they can access
    OR EXISTS (
      SELECT 1 FROM public.cash_register_movements crm
      WHERE crm.created_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.user_has_store_access(_viewer_id, crm.store_id))
    )
    -- User can view profiles linked to audit logs they can access (admin only)
    OR EXISTS (
      SELECT 1 FROM public.audit_logs al
      WHERE al.user_id = _profile_id
      AND public.has_role(_viewer_id, 'admin'::app_role)
    )
    -- User can view profiles linked to attachments they can access
    OR EXISTS (
      SELECT 1 FROM public.attachments att
      WHERE att.uploaded_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'pagador'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role))
    )
    -- User can view profiles linked to customer credit history they can access
    OR EXISTS (
      SELECT 1 FROM public.customer_credit_history cch
      WHERE cch.created_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.has_role(_viewer_id, 'pagador'::app_role))
    )
    -- User can view profiles linked to customer credit payments they can access
    OR EXISTS (
      SELECT 1 FROM public.customer_credit_payments ccp
      WHERE ccp.created_by = _profile_id
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.has_role(_viewer_id, 'pagador'::app_role))
    )
    -- User can view profiles linked to accounts receivable they can access
    OR EXISTS (
      SELECT 1 FROM public.accounts_receivable ar
      WHERE (ar.created_by = _profile_id OR ar.paid_by = _profile_id)
      AND (public.has_role(_viewer_id, 'admin'::app_role) 
           OR public.has_role(_viewer_id, 'operador'::app_role)
           OR public.has_role(_viewer_id, 'pagador'::app_role))
    )
$$;

-- Create new SELECT policy that uses the function
CREATE POLICY "Users can view accessible profiles"
ON public.profiles
FOR SELECT
USING (public.can_view_profile(auth.uid(), id));