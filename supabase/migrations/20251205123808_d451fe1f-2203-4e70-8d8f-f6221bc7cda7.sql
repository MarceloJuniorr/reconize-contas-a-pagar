-- Create table for cash register movements (sangria and suprimento)
CREATE TABLE public.cash_register_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  closing_id uuid REFERENCES public.cash_register_closings(id),
  movement_type text NOT NULL CHECK (movement_type IN ('sangria', 'suprimento')),
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_register_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized users can view movements"
  ON public.cash_register_movements
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'operador'::app_role) OR 
    user_has_store_access(auth.uid(), store_id)
  );

CREATE POLICY "Authorized users can create movements"
  ON public.cash_register_movements
  FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR 
     has_role(auth.uid(), 'operador'::app_role) OR 
     user_has_store_access(auth.uid(), store_id)) AND
    auth.uid() IS NOT NULL
  );

-- Index for performance
CREATE INDEX idx_cash_movements_store_closing ON public.cash_register_movements(store_id, closing_id);
CREATE INDEX idx_cash_movements_created_at ON public.cash_register_movements(created_at DESC);