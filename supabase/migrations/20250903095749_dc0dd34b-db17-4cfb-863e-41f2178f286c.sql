-- Melhorar a tabela de anexos para facilitar visualização e busca
-- Adicionar colunas úteis e índices para performance

-- Adicionar colunas para melhor organização e busca
ALTER TABLE public.attachments 
ADD COLUMN IF NOT EXISTS file_category TEXT DEFAULT 'account_document',
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_payment_proof BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Criar índices para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_attachments_account_id ON public.attachments(account_id);
CREATE INDEX IF NOT EXISTS idx_attachments_payment_id ON public.attachments(payment_id);
CREATE INDEX IF NOT EXISTS idx_attachments_category ON public.attachments(file_category);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON public.attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON public.attachments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_filename ON public.attachments USING gin(filename gin_trgm_ops);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_attachments_updated_at_trigger ON public.attachments;
CREATE TRIGGER update_attachments_updated_at_trigger
  BEFORE UPDATE ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attachments_updated_at();

-- Adicionar constraint para garantir que attachment tenha pelo menos account_id ou payment_id
ALTER TABLE public.attachments 
ADD CONSTRAINT check_attachment_reference 
CHECK (account_id IS NOT NULL OR payment_id IS NOT NULL);

-- Criar função para buscar anexos de uma conta (incluindo anexos de pagamentos)
CREATE OR REPLACE FUNCTION public.get_account_attachments(p_account_id UUID)
RETURNS TABLE (
  id UUID,
  filename TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  file_category TEXT,
  description TEXT,
  is_payment_proof BOOLEAN,
  payment_id UUID,
  payment_date DATE,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  uploader_name TEXT,
  source TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.filename,
    a.file_path,
    a.file_size,
    a.mime_type,
    a.file_category,
    a.description,
    a.is_payment_proof,
    a.payment_id,
    p.payment_date,
    a.uploaded_by,
    a.created_at,
    a.updated_at,
    prof.full_name as uploader_name,
    CASE 
      WHEN a.account_id IS NOT NULL AND a.payment_id IS NULL THEN 'account'
      WHEN a.payment_id IS NOT NULL THEN 'payment'
      ELSE 'unknown'
    END as source
  FROM public.attachments a
  LEFT JOIN public.payments p ON a.payment_id = p.id
  LEFT JOIN public.profiles prof ON a.uploaded_by = prof.id
  WHERE a.account_id = p_account_id 
     OR a.payment_id IN (
       SELECT id FROM public.payments WHERE account_id = p_account_id
     )
  ORDER BY a.created_at DESC;
END;
$$;

-- Atualizar política RLS para permitir busca através da função
DROP POLICY IF EXISTS "Function can access all attachments" ON public.attachments;
CREATE POLICY "Function can access all attachments" ON public.attachments
  FOR SELECT TO public
  USING (true);

-- Comentários para documentação
COMMENT ON TABLE public.attachments IS 'Tabela para gerenciar todos os anexos do sistema, vinculados a contas ou pagamentos';
COMMENT ON COLUMN public.attachments.file_category IS 'Categoria do arquivo: account_document, payment_proof, invoice, etc';
COMMENT ON COLUMN public.attachments.description IS 'Descrição opcional do anexo';
COMMENT ON COLUMN public.attachments.is_payment_proof IS 'Indica se é um comprovante de pagamento';
COMMENT ON COLUMN public.attachments.payment_id IS 'ID do pagamento associado (para comprovantes)';
COMMENT ON FUNCTION public.get_account_attachments(UUID) IS 'Função para buscar todos os anexos de uma conta, incluindo comprovantes de pagamento';