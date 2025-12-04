-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT, -- CPF ou CNPJ
  document_type TEXT DEFAULT 'cpf', -- 'cpf' ou 'cnpj'
  email TEXT,
  phone TEXT,
  phone_secondary TEXT,
  
  -- Address fields
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  
  -- Responsible user
  responsible_user_id UUID REFERENCES public.profiles(id),
  
  -- Additional info
  observations TEXT,
  credit_limit NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authorized users can view customers"
ON public.customers FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role) OR
  user_has_any_store(auth.uid())
);

CREATE POLICY "Authorized users can create customers"
ON public.customers FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role)) 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can update customers"
ON public.customers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admins can delete customers"
ON public.customers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Index for document search
CREATE INDEX idx_customers_document ON public.customers(document);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_responsible ON public.customers(responsible_user_id);