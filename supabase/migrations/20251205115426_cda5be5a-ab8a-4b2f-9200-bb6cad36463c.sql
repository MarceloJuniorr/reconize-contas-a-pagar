-- Create cash register closings table for daily cash register management
CREATE TABLE public.cash_register_closings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  closing_date DATE NOT NULL,
  opened_by UUID REFERENCES public.profiles(id),
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_by UUID REFERENCES public.profiles(id),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- Expected values (calculated from sales)
  cash_expected NUMERIC DEFAULT 0,
  card_expected NUMERIC DEFAULT 0,
  pix_expected NUMERIC DEFAULT 0,
  credit_expected NUMERIC DEFAULT 0,
  other_expected NUMERIC DEFAULT 0,
  -- Actual counted values
  cash_counted NUMERIC,
  card_counted NUMERIC,
  pix_counted NUMERIC,
  -- Calculated difference
  difference NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Unique constraint: one closing per store per day
  UNIQUE(store_id, closing_date)
);

-- Enable RLS
ALTER TABLE public.cash_register_closings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view closings for their stores"
ON public.cash_register_closings
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'operador') OR 
  user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Authorized users can create closings"
ON public.cash_register_closings
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), store_id))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update closings"
ON public.cash_register_closings
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador')
);

-- Create trigger for updated_at
CREATE TRIGGER update_cash_register_closings_updated_at
BEFORE UPDATE ON public.cash_register_closings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Function to get daily sales summary by payment method
CREATE OR REPLACE FUNCTION public.get_daily_sales_summary(
  p_store_id UUID,
  p_date DATE
)
RETURNS TABLE (
  total_sales NUMERIC,
  total_cash NUMERIC,
  total_card NUMERIC,
  total_pix NUMERIC,
  total_credit NUMERIC,
  total_other NUMERIC,
  sales_count BIGINT,
  credit_sales_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(s.total), 0) as total_sales,
    COALESCE(SUM(
      CASE WHEN pm.code = 'dinheiro' OR pm.code = 'DINHEIRO' THEN sp.amount ELSE 0 END
    ), 0) as total_cash,
    COALESCE(SUM(
      CASE WHEN pm.code IN ('cartao_credito', 'cartao_debito', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'cartao') THEN sp.amount ELSE 0 END
    ), 0) as total_card,
    COALESCE(SUM(
      CASE WHEN pm.code = 'pix' OR pm.code = 'PIX' THEN sp.amount ELSE 0 END
    ), 0) as total_pix,
    COALESCE(SUM(
      CASE WHEN sp.is_credit = true THEN sp.amount ELSE 0 END
    ), 0) as total_credit,
    COALESCE(SUM(
      CASE WHEN pm.code NOT IN ('dinheiro', 'DINHEIRO', 'cartao_credito', 'cartao_debito', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'cartao', 'pix', 'PIX') 
           AND sp.is_credit = false THEN sp.amount ELSE 0 END
    ), 0) as total_other,
    COUNT(DISTINCT s.id) as sales_count,
    COUNT(DISTINCT CASE WHEN sp.is_credit = true THEN s.id END) as credit_sales_count
  FROM public.sales s
  LEFT JOIN public.sale_payments sp ON s.id = sp.sale_id
  LEFT JOIN public.payment_methods pm ON sp.payment_method_id = pm.id
  WHERE s.store_id = p_store_id
    AND DATE(s.created_at) = p_date
    AND s.status = 'completed';
END;
$$;