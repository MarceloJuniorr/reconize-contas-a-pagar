-- Create table to track customer credit payments (paying off credit balance)
CREATE TABLE public.customer_credit_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track customer credit limit changes
CREATE TABLE public.customer_credit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'limit_change', 'purchase', 'payment'
  old_value NUMERIC,
  new_value NUMERIC,
  reference_id UUID, -- sale_id, payment_id, etc.
  reference_type TEXT, -- 'sale', 'credit_payment', 'manual'
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_credit_payments
CREATE POLICY "Authorized users can view credit payments"
ON public.customer_credit_payments FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR 
  has_role(auth.uid(), 'pagador'::app_role)
);

CREATE POLICY "Authorized users can create credit payments"
ON public.customer_credit_payments FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'operador'::app_role) OR 
   has_role(auth.uid(), 'pagador'::app_role)) AND 
  auth.uid() IS NOT NULL
);

-- RLS policies for customer_credit_history
CREATE POLICY "Authorized users can view credit history"
ON public.customer_credit_history FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR 
  has_role(auth.uid(), 'pagador'::app_role)
);

CREATE POLICY "Authorized users can create credit history"
ON public.customer_credit_history FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'operador'::app_role) OR 
   has_role(auth.uid(), 'pagador'::app_role)) AND 
  auth.uid() IS NOT NULL
);

-- Create function to log credit limit changes automatically
CREATE OR REPLACE FUNCTION public.log_credit_limit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.credit_limit IS DISTINCT FROM NEW.credit_limit THEN
    INSERT INTO public.customer_credit_history (
      customer_id, action_type, old_value, new_value, 
      reference_type, notes, created_by
    ) VALUES (
      NEW.id, 'limit_change', OLD.credit_limit, NEW.credit_limit,
      'manual', 'Alteração de limite de crédito', auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for credit limit changes
CREATE TRIGGER on_customer_credit_limit_change
  AFTER UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_credit_limit_change();

-- Create function to calculate used credit (total pending accounts receivable)
CREATE OR REPLACE FUNCTION public.get_customer_used_credit(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0)
  FROM public.accounts_receivable
  WHERE customer_id = p_customer_id AND status = 'pending'
$$;

-- Create function to get available credit
CREATE OR REPLACE FUNCTION public.get_customer_available_credit(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(c.credit_limit, 0) - public.get_customer_used_credit(p_customer_id)
  FROM public.customers c
  WHERE c.id = p_customer_id
$$;