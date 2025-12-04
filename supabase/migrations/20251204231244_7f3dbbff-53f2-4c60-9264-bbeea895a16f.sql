-- Payment Methods table (configurable)
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  allow_installments boolean DEFAULT false,
  max_installments integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Sales table
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  delivery_address_id uuid REFERENCES public.customer_delivery_addresses(id),
  delivery_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_type text, -- 'percentage' or 'fixed'
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method_id uuid REFERENCES public.payment_methods(id),
  payment_status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'partial', 'credit'
  amount_paid numeric DEFAULT 0,
  amount_credit numeric DEFAULT 0, -- valor em aberto/crediário
  installments integer DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled'
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cancelled_at timestamp with time zone,
  cancelled_by uuid REFERENCES public.profiles(id),
  cancellation_reason text
);

-- Sale Items table
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  discount_type text, -- 'percentage' or 'fixed'
  discount_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Accounts Receivable table (for crediário)
CREATE TABLE public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_amount numeric DEFAULT 0,
  paid_at timestamp with time zone,
  paid_by uuid REFERENCES public.profiles(id),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Payment Methods policies
CREATE POLICY "Authorized users can view payment methods"
ON public.payment_methods FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_any_store(auth.uid()));

CREATE POLICY "Admin and operador can create payment methods"
ON public.payment_methods FOR INSERT
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador')) AND auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can update payment methods"
ON public.payment_methods FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'));

CREATE POLICY "Only admin can delete payment methods"
ON public.payment_methods FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Sales policies
CREATE POLICY "Authorized users can view sales"
ON public.sales FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), store_id));

CREATE POLICY "Authorized users can create sales"
ON public.sales FOR INSERT
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), store_id)) AND auth.uid() IS NOT NULL);

CREATE POLICY "Admin and operador can update sales"
ON public.sales FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador'));

-- Sale Items policies
CREATE POLICY "Authorized users can view sale items"
ON public.sale_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales s 
  WHERE s.id = sale_id 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), s.store_id))
));

CREATE POLICY "Authorized users can create sale items"
ON public.sale_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s 
  WHERE s.id = sale_id 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), s.store_id))
) AND auth.uid() IS NOT NULL);

-- Accounts Receivable policies
CREATE POLICY "Authorized users can view accounts receivable"
ON public.accounts_receivable FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'pagador'));

CREATE POLICY "Authorized users can create accounts receivable"
ON public.accounts_receivable FOR INSERT
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador')) AND auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can update accounts receivable"
ON public.accounts_receivable FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR has_role(auth.uid(), 'pagador'));

-- Function to generate sale number
CREATE OR REPLACE FUNCTION public.generate_sale_number(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_code TEXT;
  v_next_number INTEGER;
  v_sale_number TEXT;
BEGIN
  SELECT code INTO v_store_code FROM public.stores WHERE id = p_store_id;
  
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(sale_number, '-', 2) AS INTEGER)
  ), 0) + 1 INTO v_next_number
  FROM public.sales
  WHERE store_id = p_store_id;
  
  v_sale_number := v_store_code || '-' || LPAD(v_next_number::TEXT, 6, '0');
  
  RETURN v_sale_number;
END;
$$;

-- Function to update customer credit limit usage
CREATE OR REPLACE FUNCTION public.update_customer_credit_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a sale with credit is created, we track the receivable
  -- The credit_limit check happens in the application
  RETURN NEW;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default payment methods
INSERT INTO public.payment_methods (name, code, allow_installments, max_installments) VALUES
('Dinheiro', 'cash', false, 1),
('Cartão de Débito', 'debit', false, 1),
('Cartão de Crédito', 'credit', true, 12),
('PIX', 'pix', false, 1),
('Crediário', 'store_credit', true, 6);

-- Indexes
CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_accounts_receivable_customer_id ON public.accounts_receivable(customer_id);
CREATE INDEX idx_accounts_receivable_status ON public.accounts_receivable(status);