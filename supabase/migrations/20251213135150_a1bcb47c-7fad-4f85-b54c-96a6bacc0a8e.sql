-- Migration 1: Add 'caixa' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'caixa';