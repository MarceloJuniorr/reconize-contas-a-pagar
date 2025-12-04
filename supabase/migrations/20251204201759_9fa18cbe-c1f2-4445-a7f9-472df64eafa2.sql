-- Atualizar política de SELECT em suppliers para incluir usuários com acesso a lojas
DROP POLICY IF EXISTS "Authorized users can view suppliers" ON public.suppliers;

CREATE POLICY "Authorized users can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pagador'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR
  user_has_any_store(auth.uid())
);