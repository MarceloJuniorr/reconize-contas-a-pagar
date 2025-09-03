-- Primeiro, remove políticas que usam has_role
DROP POLICY IF EXISTS "Admins can manage cost centers" ON public.cost_centers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can update all accounts" ON public.accounts_payable;
DROP POLICY IF EXISTS "Users can update non-protected fields" ON public.accounts_payable;
DROP POLICY IF EXISTS "Admins and pagadores can create payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Remove funções que dependem do tipo
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.get_user_roles(uuid);

-- Remove e recria o tipo app_role
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('admin', 'pagador', 'operador', 'leitor');

-- Recriar tabela user_roles
DROP TABLE IF EXISTS user_roles CASCADE;
CREATE TABLE public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Recriar função has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Recriar função get_user_roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS app_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Recriar políticas RLS
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Recriar políticas para outras tabelas
CREATE POLICY "Admins can manage cost centers"
ON public.cost_centers
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage suppliers"
ON public.suppliers
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all accounts"
ON public.accounts_payable
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update non-protected fields"
ON public.accounts_payable
FOR UPDATE
USING ((auth.uid() IS NOT NULL) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pagador') OR has_role(auth.uid(), 'operador')));

CREATE POLICY "Admins and pagadores can create payments"
ON public.payments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pagador'));

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Atualizar função handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  
  -- Dar papel admin ao primeiro usuário, senão dar papel operador por padrão
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operador');
  END IF;
  
  RETURN NEW;
END;
$$;