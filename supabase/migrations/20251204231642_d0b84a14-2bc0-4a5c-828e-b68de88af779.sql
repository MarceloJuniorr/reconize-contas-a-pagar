-- Function to update stock quantity
CREATE OR REPLACE FUNCTION public.update_stock_quantity(p_product_id uuid, p_store_id uuid, p_quantity numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_stock
  SET quantity = quantity + p_quantity,
      updated_at = now()
  WHERE product_id = p_product_id AND store_id = p_store_id;
  
  -- If no row was updated, insert a new one (shouldn't happen normally)
  IF NOT FOUND THEN
    INSERT INTO public.product_stock (product_id, store_id, quantity)
    VALUES (p_product_id, p_store_id, p_quantity);
  END IF;
END;
$$;