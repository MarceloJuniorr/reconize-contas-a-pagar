
-- Create stock_receipt_headers table for receipt documents
CREATE TABLE public.stock_receipt_headers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  receipt_number TEXT NOT NULL,
  invoice_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  received_by UUID REFERENCES public.profiles(id),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cancelled_by UUID REFERENCES public.profiles(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, receipt_number)
);

-- Add header reference to stock_receipts (items)
ALTER TABLE public.stock_receipts 
ADD COLUMN header_id UUID REFERENCES public.stock_receipt_headers(id);

-- Create stock_movements table for tracking all movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  movement_type TEXT NOT NULL, -- 'entry' or 'exit'
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  unit_price NUMERIC,
  reference_type TEXT NOT NULL, -- 'receipt', 'sale', 'adjustment', 'transfer'
  reference_id UUID, -- ID of the document (receipt_header_id, sale_id, etc)
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_receipt_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for stock_receipt_headers
CREATE POLICY "Authorized users can view receipt headers"
ON public.stock_receipt_headers FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR 
  user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Authorized users can create receipt headers"
ON public.stock_receipt_headers FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'operador'::app_role) OR 
   user_has_store_access(auth.uid(), store_id)) AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update receipt headers"
ON public.stock_receipt_headers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

-- RLS policies for stock_movements
CREATE POLICY "Authorized users can view movements"
ON public.stock_movements FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR 
  user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Authorized users can create movements"
ON public.stock_movements FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR 
   has_role(auth.uid(), 'operador'::app_role) OR 
   user_has_store_access(auth.uid(), store_id)) AND 
  auth.uid() IS NOT NULL
);

-- Function to generate sequential receipt number per store
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_code TEXT;
  v_next_number INTEGER;
  v_receipt_number TEXT;
BEGIN
  -- Get store code
  SELECT code INTO v_store_code FROM public.stores WHERE id = p_store_id;
  
  -- Get next number for this store
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(receipt_number, '-', 2) AS INTEGER)
  ), 0) + 1 INTO v_next_number
  FROM public.stock_receipt_headers
  WHERE store_id = p_store_id;
  
  -- Format: STORECODE-NNNNNN
  v_receipt_number := v_store_code || '-' || LPAD(v_next_number::TEXT, 6, '0');
  
  RETURN v_receipt_number;
END;
$$;

-- Function to cancel receipt and reverse stock
CREATE OR REPLACE FUNCTION public.cancel_stock_receipt(
  p_header_id UUID,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_store_id UUID;
BEGIN
  -- Get store_id and verify receipt is active
  SELECT store_id INTO v_store_id
  FROM public.stock_receipt_headers
  WHERE id = p_header_id AND status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado ou já cancelado';
  END IF;
  
  -- Reverse stock for each item
  FOR v_item IN 
    SELECT product_id, quantity, new_cost_price, new_sale_price
    FROM public.stock_receipts
    WHERE header_id = p_header_id
  LOOP
    -- Subtract quantity from stock
    UPDATE public.product_stock
    SET quantity = quantity - v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id AND store_id = v_store_id;
    
    -- Create reversal movement
    INSERT INTO public.stock_movements (
      product_id, store_id, movement_type, quantity, 
      unit_cost, unit_price, reference_type, reference_id, 
      notes, created_by
    ) VALUES (
      v_item.product_id, v_store_id, 'exit', v_item.quantity,
      v_item.new_cost_price, v_item.new_sale_price, 'receipt_cancellation', p_header_id,
      'Cancelamento do recebimento: ' || p_reason, p_user_id
    );
  END LOOP;
  
  -- Update header status
  UPDATE public.stock_receipt_headers
  SET status = 'cancelled',
      cancelled_by = p_user_id,
      cancelled_at = now(),
      cancellation_reason = p_reason
  WHERE id = p_header_id;
  
  RETURN TRUE;
END;
$$;

-- Update process_stock_receipt trigger to also create movement records
CREATE OR REPLACE FUNCTION public.process_stock_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar ou criar estoque
  INSERT INTO public.product_stock (product_id, store_id, quantity)
  VALUES (NEW.product_id, NEW.store_id, NEW.quantity)
  ON CONFLICT (product_id, store_id) 
  DO UPDATE SET 
    quantity = product_stock.quantity + NEW.quantity,
    updated_at = now();

  -- Marcar preço anterior como não atual
  UPDATE public.product_pricing 
  SET is_current = false, valid_until = now()
  WHERE product_id = NEW.product_id 
    AND store_id = NEW.store_id 
    AND is_current = true;

  -- Inserir novo preço
  INSERT INTO public.product_pricing (product_id, store_id, cost_price, sale_price, created_by)
  VALUES (NEW.product_id, NEW.store_id, NEW.new_cost_price, NEW.new_sale_price, NEW.received_by);

  -- Create stock movement record
  INSERT INTO public.stock_movements (
    product_id, store_id, movement_type, quantity,
    unit_cost, unit_price, reference_type, reference_id,
    created_by
  ) VALUES (
    NEW.product_id, NEW.store_id, 'entry', NEW.quantity,
    NEW.new_cost_price, NEW.new_sale_price, 'receipt', NEW.header_id,
    NEW.received_by
  );

  RETURN NEW;
END;
$$;
