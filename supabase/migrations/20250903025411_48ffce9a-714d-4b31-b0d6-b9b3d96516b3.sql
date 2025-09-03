-- Primeiro, dropar tudo que pode causar conflito
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS app_role CASCADE;

-- Criar o novo enum de papéis
CREATE TYPE app_role AS ENUM ('admin', 'pagador', 'operador', 'leitor');

-- Criar a tabela user_roles
CREATE TABLE public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamp with time zone default now(),
  unique (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;