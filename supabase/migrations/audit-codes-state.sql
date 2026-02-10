-- ============================================================================
-- Script de Auditoría: Estado actual de códigos
-- Fecha: 2026-02-08
-- Propósito: Diagnosticar problemas antes de aplicar migración
-- ============================================================================

-- 1. CÓDIGOS DUPLICADOS ACTIVOS
SELECT 
  '1. Códigos duplicados activos' AS reporte;

SELECT 
  code,
  COUNT(*) as total_eventos,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as activos,
  STRING_AGG(DISTINCT e.name, ' | ') as eventos_afectados,
  STRING_AGG(DISTINCT c.event_id::text, ', ') as event_ids
FROM public.codes c
LEFT JOIN public.events e ON e.id = c.event_id
WHERE c.deleted_at IS NULL
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY total_eventos DESC, code;

-- 2. EVENTOS CON MÚLTIPLES CÓDIGOS GENERALES ACTIVOS
SELECT 
  '2. Eventos con múltiples códigos generales' AS reporte;

SELECT 
  e.name as evento,
  e.id as event_id,
  COUNT(*) as cantidad_codigos_general,
  STRING_AGG(c.code, ', ' ORDER BY c.updated_at DESC) as codigos,
  STRING_AGG(c.id::text, ', ') as code_ids
FROM public.codes c
JOIN public.events e ON e.id = c.event_id
WHERE c.type = 'general'
  AND c.is_active = true
  AND c.deleted_at IS NULL
  AND e.deleted_at IS NULL
GROUP BY e.name, e.id
HAVING COUNT(*) > 1
ORDER BY e.name;

-- 3. CÓDIGOS CON SOFT-DELETE QUE PODRÍAN CAUSAR CONFLICTOS
SELECT 
  '3. Códigos soft-deleted que bloquean reuso' AS reporte;

SELECT 
  c.code,
  c.type,
  e.name as evento_eliminado,
  c.deleted_at,
  c.is_active
FROM public.codes c
LEFT JOIN public.events e ON e.id = c.event_id
WHERE c.deleted_at IS NOT NULL
  AND c.code IN (
    SELECT code FROM public.codes 
    WHERE deleted_at IS NULL
  )
ORDER BY c.code, c.deleted_at DESC;

-- 4. CÓDIGOS QUE PERTENECEN A EVENTOS DE DIFERENTES ORGANIZADORES
SELECT 
  '4. Códigos compartidos entre organizadores' AS reporte;

SELECT 
  c.code,
  COUNT(DISTINCT e.organizer_id) as organizadores_diferentes,
  STRING_AGG(DISTINCT o.name, ' | ') as organizadores,
  STRING_AGG(DISTINCT e.name, ' | ') as eventos
FROM public.codes c
JOIN public.events e ON e.id = c.event_id
LEFT JOIN public.organizers o ON o.id = e.organizer_id
WHERE c.deleted_at IS NULL
  AND e.deleted_at IS NULL
GROUP BY c.code
HAVING COUNT(DISTINCT e.organizer_id) > 1
ORDER BY c.code;

-- 5. ESTADÍSTICAS GENERALES
SELECT 
  '5. Estadísticas generales de códigos' AS reporte;

SELECT
  COUNT(*) as total_codigos,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as activos,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted,
  COUNT(CASE WHEN type = 'general' AND deleted_at IS NULL THEN 1 END) as codigos_general_activos,
  COUNT(CASE WHEN type = 'promoter' AND deleted_at IS NULL THEN 1 END) as codigos_promotor_activos,
  COUNT(CASE WHEN type = 'courtesy' AND deleted_at IS NULL THEN 1 END) as codigos_cortesia_activos,
  COUNT(DISTINCT code) as codigos_unicos,
  COUNT(DISTINCT event_id) as eventos_con_codigos
FROM public.codes;

-- 6. CÓDIGOS SIN EVENTO ASOCIADO (HUÉRFANOS)
SELECT 
  '6. Códigos huérfanos (sin evento válido)' AS reporte;

SELECT 
  c.id,
  c.code,
  c.type,
  c.event_id,
  c.created_at,
  c.deleted_at
FROM public.codes c
LEFT JOIN public.events e ON e.id = c.event_id
WHERE e.id IS NULL
  AND c.deleted_at IS NULL
ORDER BY c.created_at DESC
LIMIT 20;

-- 7. VERIFICAR CONSTRAINT UNIQUE ACTUAL
SELECT 
  '7. Constraints actuales en tabla codes' AS reporte;

SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.codes'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;

-- 8. VERIFICAR ÍNDICES PARCIALES ACTUALES
SELECT 
  '8. Índices en tabla codes' AS reporte;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'codes'
  AND schemaname = 'public'
ORDER BY indexname;

-- 9. PREVIEW DE REGISTROS QUE SERÁN AFECTADOS POR LA MIGRACIÓN
SELECT 
  '9. Preview de códigos que serán soft-deleted' AS reporte;

WITH duplicates AS (
  SELECT 
    id,
    code,
    event_id,
    type,
    is_active,
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
SELECT 
  d.code,
  d.type,
  e.name as evento,
  d.is_active,
  'SERÁ SOFT-DELETED' as accion
FROM duplicates d
LEFT JOIN public.events e ON e.id = d.event_id
WHERE d.rn > 1
ORDER BY d.code, e.name;

-- 10. RESUMEN EJECUTIVO
SELECT 
  '10. RESUMEN EJECUTIVO' AS reporte;

WITH stats AS (
  SELECT
    COUNT(*) as total_codigos,
    COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as activos,
    (SELECT COUNT(*) FROM (
      SELECT code FROM public.codes WHERE deleted_at IS NULL
      GROUP BY code HAVING COUNT(*) > 1
    ) dups) as codigos_duplicados,
    (SELECT COUNT(*) FROM (
      SELECT event_id FROM public.codes 
      WHERE type = 'general' AND is_active = true AND deleted_at IS NULL
      GROUP BY event_id HAVING COUNT(*) > 1
    ) multi) as eventos_con_multi_general
  FROM public.codes
)
SELECT
  total_codigos,
  activos,
  codigos_duplicados,
  eventos_con_multi_general,
  CASE 
    WHEN codigos_duplicados > 0 OR eventos_con_multi_general > 0 
    THEN '🔴 REQUIERE MIGRACIÓN'
    ELSE '✅ ESTADO SALUDABLE'
  END as estado,
  CASE
    WHEN codigos_duplicados > 0 OR eventos_con_multi_general > 0
    THEN 'Aplicar migración 2026-02-08-fix-code-uniqueness.sql'
    ELSE 'No se requiere acción'
  END as recomendacion
FROM stats;
