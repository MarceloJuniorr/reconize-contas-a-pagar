-- Create delivery addresses table for customers
CREATE TABLE public.customer_delivery_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Ex: "Casa", "Trabalho", "Loja Principal"
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_delivery_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized users can view delivery addresses"
  ON public.customer_delivery_addresses FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role) OR
    user_has_any_store(auth.uid())
  );

CREATE POLICY "Authorized users can create delivery addresses"
  ON public.customer_delivery_addresses FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authorized users can update delivery addresses"
  ON public.customer_delivery_addresses FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'operador'::app_role)
  );

CREATE POLICY "Only admins can delete delivery addresses"
  ON public.customer_delivery_addresses FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_customer_delivery_addresses_updated_at
  BEFORE UPDATE ON public.customer_delivery_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for customer lookup
CREATE INDEX idx_customer_delivery_addresses_customer_id ON public.customer_delivery_addresses(customer_id);