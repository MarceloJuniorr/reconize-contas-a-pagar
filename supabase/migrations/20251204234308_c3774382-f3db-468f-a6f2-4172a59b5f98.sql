-- Add PDV configuration columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS pdv_auto_print boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pdv_print_format text DEFAULT 'a4',
ADD COLUMN IF NOT EXISTS pdv_max_discount_percent numeric DEFAULT 100;

-- Add cancellation fields to sales table if not exist
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id);

-- Function to cancel a sale and reverse stock
CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_user_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_store_id UUID;
  v_sale_status TEXT;
BEGIN
  -- Get sale info and verify it's not already cancelled
  SELECT store_id, status INTO v_store_id, v_sale_status
  FROM public.sales
  WHERE id = p_sale_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;
  
  IF v_sale_status = 'cancelled' THEN
    RAISE EXCEPTION 'Venda já está cancelada';
  END IF;
  
  -- Reverse stock for each item
  FOR v_item IN 
    SELECT si.product_id, si.quantity, si.unit_price
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
  LOOP
    -- Add quantity back to stock
    UPDATE public.product_stock
    SET quantity = quantity + v_item.quantity,
        updated_at = now()
    WHERE product_id = v_item.product_id AND store_id = v_store_id;
    
    -- Create reversal movement (entry)
    INSERT INTO public.stock_movements (
      product_id, store_id, movement_type, quantity, 
      unit_price, reference_type, reference_id, 
      notes, created_by
    ) VALUES (
      v_item.product_id, v_store_id, 'entry', v_item.quantity,
      v_item.unit_price, 'sale_cancellation', p_sale_id,
      'Cancelamento da venda: ' || p_reason, p_user_id
    );
  END LOOP;
  
  -- Update sale status
  UPDATE public.sales
  SET status = 'cancelled',
      cancelled_by = p_user_id,
      cancelled_at = now(),
      cancellation_reason = p_reason
  WHERE id = p_sale_id;
  
  -- Cancel related accounts receivable if exists
  UPDATE public.accounts_receivable
  SET status = 'cancelled',
      updated_at = now()
  WHERE sale_id = p_sale_id AND status = 'pending';
  
  RETURN TRUE;
END;
$$;