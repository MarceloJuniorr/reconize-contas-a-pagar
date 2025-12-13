-- Drop existing customers policies
DROP POLICY IF EXISTS "Authorized users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can delete customers" ON public.customers;

-- New SELECT policy: admin, caixa, and store users can view customers (removed operador)
CREATE POLICY "Authorized users can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'caixa'::app_role) OR 
    user_has_any_store(auth.uid())
  );

-- New INSERT policy: only admin and caixa can create customers (removed operador)
CREATE POLICY "Authorized users can create customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'caixa'::app_role)) 
    AND auth.uid() IS NOT NULL
  );

-- New UPDATE policy: admin and caixa can update (trigger will protect credit_limit)
CREATE POLICY "Authorized users can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'caixa'::app_role));

-- Keep admin delete policy
CREATE POLICY "Only admins can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a trigger function to enforce credit_limit protection for non-admin users
CREATE OR REPLACE FUNCTION public.protect_credit_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If credit_limit is being changed
  IF OLD.credit_limit IS DISTINCT FROM NEW.credit_limit THEN
    -- Only allow if user is admin
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      -- Reset to old value
      NEW.credit_limit := OLD.credit_limit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for credit_limit protection
DROP TRIGGER IF EXISTS protect_credit_limit_trigger ON public.customers;
CREATE TRIGGER protect_credit_limit_trigger
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_credit_limit();

-- Create a trigger function to enforce zero credit_limit for caixa on INSERT
CREATE OR REPLACE FUNCTION public.enforce_zero_credit_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If user is caixa (not admin), force credit_limit to 0
  IF has_role(auth.uid(), 'caixa'::app_role) AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.credit_limit := 0;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for zero credit on caixa insert
DROP TRIGGER IF EXISTS enforce_zero_credit_on_insert_trigger ON public.customers;
CREATE TRIGGER enforce_zero_credit_on_insert_trigger
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_zero_credit_on_insert();

-- Update customer_delivery_addresses policies to include caixa (removed operador)
DROP POLICY IF EXISTS "Authorized users can view delivery addresses" ON public.customer_delivery_addresses;
DROP POLICY IF EXISTS "Authorized users can create delivery addresses" ON public.customer_delivery_addresses;
DROP POLICY IF EXISTS "Authorized users can update delivery addresses" ON public.customer_delivery_addresses;

CREATE POLICY "Authorized users can view delivery addresses" ON public.customer_delivery_addresses
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'caixa'::app_role) OR 
    user_has_any_store(auth.uid())
  );

CREATE POLICY "Authorized users can create delivery addresses" ON public.customer_delivery_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'caixa'::app_role)) 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authorized users can update delivery addresses" ON public.customer_delivery_addresses
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'caixa'::app_role));