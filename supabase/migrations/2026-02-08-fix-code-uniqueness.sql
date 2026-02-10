-- ============================================================================
-- Migración: Corrección de constraint UNIQUE en codes
-- Fecha: 2026-02-08
-- Objetivo: Resolver problema de edición de códigos entre eventos
-- Severidad: ALTA
-- Documento: docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md
-- ============================================================================

-- 1. BACKUP SAFETY: Verificar estado actual
DO $$
DECLARE
  v_duplicates integer;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT code FROM public.codes 
    WHERE deleted_at IS NULL
    GROUP BY code HAVING COUNT(*) > 1
  ) AS dups;
  
  RAISE NOTICE 'Códigos duplicados activos encontrados: %', v_duplicates;
END $$;

-- 2. CLEANUP: Desactivar códigos duplicados (mantener el más reciente por evento)
WITH duplicates AS (
  SELECT 
    id,
    code,
    event_id,
    ROW_NUMBER() OVER (
      PARTITION BY code 
      ORDER BY 
        CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.codes
)
UPDATE public.codes c
SET is_active = false, updated_at = now()
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1 AND c.is_active = true;

-- 3. SOFT DELETE: Marcar duplicados antiguos como eliminados
WITH duplicates AS (
  SELECT 
    id,
    code,
    ROW_NUMBER() OVER (
      PARTITION BY code 
      ORDER BY 
        CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END,
        updated_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.codes
  WHERE deleted_at IS NULL
)
UPDATE public.codes c
SET deleted_at = now(), updated_at = now()
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1;

-- 4. REMOVER constraint UNIQUE global
ALTER TABLE public.codes DROP CONSTRAINT IF EXISTS codes_code_key;

-- 5. CREAR índice parcial único por evento
DROP INDEX IF EXISTS codes_unique_per_event;
CREATE UNIQUE INDEX codes_unique_per_event 
  ON public.codes(code, event_id) 
  WHERE deleted_at IS NULL AND is_active = true;

-- 6. ACTUALIZAR índice de código general para incluir soft-delete
DROP INDEX IF EXISTS codes_one_active_general_per_event;
CREATE UNIQUE INDEX codes_one_active_general_per_event
  ON public.codes(event_id)
  WHERE type = 'general' AND is_active = true AND deleted_at IS NULL;

-- 7. ACTUALIZAR función set_event_general_code
CREATE OR REPLACE FUNCTION public.set_event_general_code(
  p_event_id uuid, 
  p_code text, 
  p_capacity integer DEFAULT NULL
)
RETURNS public.codes
LANGUAGE plpgsql
AS $$
DECLARE
  v_result public.codes;
  v_capacity integer;
  v_existing_event uuid;
  v_current public.codes;
BEGIN
  -- Validación
  IF p_event_id IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RAISE EXCEPTION 'event_id and code are required';
  END IF;

  -- Capacity fallback
  SELECT capacity INTO v_capacity FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El evento % no existe', p_event_id USING errcode = 'P0002';
  END IF;
  IF p_capacity IS NOT NULL THEN
    v_capacity := p_capacity;
  END IF;
  v_capacity := greatest(coalesce(v_capacity, 1000000), 1);

  -- ✅ FIX: Verificar conflicto solo en códigos activos NO soft-deleted
  SELECT event_id INTO v_existing_event
  FROM public.codes
  WHERE code = trim(p_code)
    AND deleted_at IS NULL  -- ✅ Excluir soft-deletes
    AND is_active = true     -- ✅ Solo activos
    AND event_id <> p_event_id -- ✅ Excluir el mismo evento
  LIMIT 1;

  IF v_existing_event IS NOT NULL THEN
    RAISE EXCEPTION 'El código % ya está asignado a otro evento diferente', p_code 
      USING errcode = '23505';
  END IF;

  -- Obtener código general actual del evento
  SELECT * INTO v_current
  FROM public.codes
  WHERE event_id = p_event_id
    AND type = 'general'
    AND deleted_at IS NULL
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  -- Desactivar otros códigos generales del evento
  UPDATE public.codes
  SET is_active = false, updated_at = now()
  WHERE event_id = p_event_id
    AND type = 'general'
    AND (v_current.id IS NULL OR id <> v_current.id)
    AND is_active = true;

  -- Actualizar o insertar
  IF v_current.id IS NOT NULL THEN
    UPDATE public.codes
    SET code = trim(p_code),
        is_active = true,
        promoter_id = null,
        max_uses = v_capacity,
        updated_at = now()
    WHERE id = v_current.id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.codes (code, event_id, type, is_active, max_uses)
    VALUES (trim(p_code), p_event_id, 'general', true, v_capacity)
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 8. ÍNDICES de auditoría y performance
CREATE INDEX IF NOT EXISTS idx_codes_event_deleted 
  ON public.codes(event_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_codes_active_lookup
  ON public.codes(code, is_active, deleted_at);

-- 9. VERIFICACIÓN final
DO $$
DECLARE
  v_duplicates integer;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT code, event_id
    FROM public.codes
    WHERE deleted_at IS NULL AND is_active = true
    GROUP BY code, event_id
    HAVING COUNT(*) > 1
  ) AS dups;
  
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION 'Migración fallida: aún existen % códigos duplicados activos por evento', v_duplicates;
  END IF;
  
  RAISE NOTICE '✅ Migración exitosa: unicidad de códigos por evento garantizada';
END $$;

-- 10. COMENTARIOS para documentación
COMMENT ON INDEX codes_unique_per_event IS 
  'Garantiza que un código solo puede existir una vez por evento (excluyendo soft-deletes)';

COMMENT ON INDEX codes_one_active_general_per_event IS 
  'Garantiza que solo existe un código general activo por evento (excluyendo soft-deletes)';

COMMENT ON FUNCTION public.set_event_general_code IS 
  'Crea o actualiza el código general de un evento, garantizando unicidad y excluyendo soft-deletes';
