-- Create sale_payments table for multiple payments per sale
CREATE TABLE public.sale_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES public.payment_methods(id),
    amount NUMERIC NOT NULL DEFAULT 0,
    installments INTEGER DEFAULT 1,
    is_credit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authorized users can create sale payments"
ON public.sale_payments
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sales s 
        WHERE s.id = sale_payments.sale_id 
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), s.store_id))
    )
    AND auth.uid() IS NOT NULL
);

CREATE POLICY "Authorized users can view sale payments"
ON public.sale_payments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sales s 
        WHERE s.id = sale_payments.sale_id 
        AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operador') OR user_has_store_access(auth.uid(), s.store_id))
    )
);

-- Add delivery_type to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'pickup';