-- Fix cost_centers SELECT policy to restrict access to authorized roles only
DROP POLICY IF EXISTS "Authenticated users can view cost centers" ON public.cost_centers;

CREATE POLICY "Authorized users can view cost centers" ON public.cost_centers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'operador'::app_role) OR 
    has_role(auth.uid(), 'pagador'::app_role)
  );