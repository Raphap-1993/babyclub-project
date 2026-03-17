-- Migration: add 'promoter_link' code type and make max_uses nullable
-- Promoter links are used as direct registration URLs (?code=WILLIAMS)
-- They have unlimited uses (max_uses = NULL) and auto-assign promoter_id

-- 1. Add 'promoter_link' to the type CHECK constraint
ALTER TABLE public.codes DROP CONSTRAINT IF EXISTS codes_type_check;
ALTER TABLE public.codes ADD CONSTRAINT codes_type_check
  CHECK (type IN ('courtesy', 'promoter', 'table', 'general', 'promoter_link'));

-- 2. Make max_uses nullable to represent unlimited uses
ALTER TABLE public.codes ALTER COLUMN max_uses DROP NOT NULL;
ALTER TABLE public.codes ALTER COLUMN max_uses DROP DEFAULT;
ALTER TABLE public.codes DROP CONSTRAINT IF EXISTS codes_max_uses_check;
ALTER TABLE public.codes ADD CONSTRAINT codes_max_uses_check
  CHECK (max_uses IS NULL OR max_uses >= 1);
