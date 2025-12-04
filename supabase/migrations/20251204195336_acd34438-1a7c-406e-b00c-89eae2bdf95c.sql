-- Criar tabela de lojas
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  cnpj text,
  address text,
  phone text,
  email text,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de vínculo usuário-loja
CREATE TABLE public.user_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- Criar tabela de marcas
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de categorias
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de unidades
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar sequência para código interno de produtos
CREATE SEQUENCE public.product_internal_code_seq START 1000;

-- Criar tabela de produtos (unificada)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_code text NOT NULL UNIQUE,
  ean text,
  name text NOT NULL,
  description text,
  brand_id uuid REFERENCES public.brands(id),
  category_id uuid REFERENCES public.categories(id),
  unit_id uuid REFERENCES public.units(id),
  image_url text,
  active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de precificação por loja (com histórico)
CREATE TABLE public.product_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  markup numeric(8,2) GENERATED ALWAYS AS (
    CASE WHEN cost_price > 0 THEN ((sale_price - cost_price) / cost_price) * 100 ELSE 0 END
  ) STORED,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_current boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de estoque por loja
CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  min_quantity numeric(12,3) DEFAULT 0,
  max_quantity numeric(12,3),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, store_id)
);

-- Criar tabela de recebimento de mercadorias
CREATE TABLE public.stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric(12,3) NOT NULL,
  old_sale_price numeric(12,2),
  new_cost_price numeric(12,2) NOT NULL,
  new_sale_price numeric(12,2) NOT NULL,
  markup numeric(8,2) GENERATED ALWAYS AS (
    CASE WHEN new_cost_price > 0 THEN ((new_sale_price - new_cost_price) / new_cost_price) * 100 ELSE 0 END
  ) STORED,
  notes text,
  received_by uuid REFERENCES auth.users(id),
  received_at timestamptz DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário tem acesso a uma loja
CREATE OR REPLACE FUNCTION public.user_has_store_access(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_stores
    WHERE user_id = _user_id AND store_id = _store_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- Função para verificar se usuário tem alguma loja vinculada
CREATE OR REPLACE FUNCTION public.user_has_any_store(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_stores WHERE user_id = _user_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

-- Políticas para stores
CREATE POLICY "Users with store access can view stores" ON public.stores
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  id IN (SELECT store_id FROM public.user_stores WHERE user_id = auth.uid())
);

CREATE POLICY "Admin and operador can create stores" ON public.stores
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update stores" ON public.stores
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admin can delete stores" ON public.stores
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Políticas para user_stores
CREATE POLICY "Admin can manage user_stores" ON public.user_stores
FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own store links" ON public.user_stores
FOR SELECT USING (user_id = auth.uid());

-- Políticas para brands, categories, units (similar)
CREATE POLICY "Authorized users can view brands" ON public.brands
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_any_store(auth.uid())
);

CREATE POLICY "Admin and operador can create brands" ON public.brands
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update brands" ON public.brands
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admin can delete brands" ON public.brands
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Categories policies
CREATE POLICY "Authorized users can view categories" ON public.categories
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_any_store(auth.uid())
);

CREATE POLICY "Admin and operador can create categories" ON public.categories
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update categories" ON public.categories
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admin can delete categories" ON public.categories
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Units policies
CREATE POLICY "Authorized users can view units" ON public.units
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_any_store(auth.uid())
);

CREATE POLICY "Admin and operador can create units" ON public.units
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update units" ON public.units
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admin can delete units" ON public.units
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Products policies
CREATE POLICY "Authorized users can view products" ON public.products
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_any_store(auth.uid())
);

CREATE POLICY "Admin and operador can create products" ON public.products
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update products" ON public.products
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

CREATE POLICY "Only admin can delete products" ON public.products
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Product pricing policies
CREATE POLICY "Users can view pricing for their stores" ON public.product_pricing
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Admin and operador can create pricing" ON public.product_pricing
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admin and operador can update pricing" ON public.product_pricing
FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role)
);

-- Product stock policies
CREATE POLICY "Users can view stock for their stores" ON public.product_stock
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Authorized users can manage stock" ON public.product_stock
FOR ALL USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_store_access(auth.uid(), store_id)
);

-- Stock receipts policies
CREATE POLICY "Users can view receipts for their stores" ON public.stock_receipts
FOR SELECT USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'operador'::app_role) OR
  public.user_has_store_access(auth.uid(), store_id)
);

CREATE POLICY "Authorized users can create receipts" ON public.stock_receipts
FOR INSERT WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'operador'::app_role) OR
   public.user_has_store_access(auth.uid(), store_id))
  AND auth.uid() IS NOT NULL
);

-- Trigger para atualizar estoque e preço no recebimento
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_stock_receipt
  AFTER INSERT ON public.stock_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.process_stock_receipt();

-- Triggers para updated_at
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Inserir unidades padrão
INSERT INTO public.units (name, abbreviation) VALUES 
  ('Unidade', 'UN'),
  ('Quilograma', 'KG'),
  ('Grama', 'G'),
  ('Litro', 'L'),
  ('Mililitro', 'ML'),
  ('Metro', 'M'),
  ('Centímetro', 'CM'),
  ('Caixa', 'CX'),
  ('Pacote', 'PCT'),
  ('Fardo', 'FD');