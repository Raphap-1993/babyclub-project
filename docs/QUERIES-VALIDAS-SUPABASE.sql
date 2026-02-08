-- ==========================================
-- QUERIES VÁLIDAS PARA POSTGRESQL/SUPABASE
-- Ejecuta CADA UNA por separado
-- ==========================================

-- QUERY 1: Ver exactamente qué columnas tiene 'tables'
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tables' AND table_schema = 'public'
ORDER BY ordinal_position;

-- QUERY 2: Ver si organizer_id existe y cuántos NULLs hay
SELECT 
  COUNT(*) as total_filas,
  COUNT(organizer_id) as filas_con_organizer_id,
  COUNT(*) - COUNT(organizer_id) as filas_con_null_organizer_id
FROM public.tables;

-- QUERY 3: Ver todos los eventos y cuántas mesas tiene cada una
SELECT 
  e.id,
  e.name,
  e.organizer_id,
  COUNT(t.id) as total_mesas
FROM public.events e
LEFT JOIN public.tables t ON e.id = t.event_id AND t.deleted_at IS NULL
GROUP BY e.id, e.name, e.organizer_id
ORDER BY e.created_at DESC;

-- QUERY 4: Ver organizadores disponibles
SELECT id, slug, name FROM public.organizers WHERE is_active = true;

-- QUERY 5: Ver problemas en tables (mesas sin event_id o sin organizer_id)
SELECT 
  t.id,
  t.name,
  t.event_id,
  t.organizer_id,
  CASE 
    WHEN t.event_id IS NULL THEN 'PROBLEMA: no tiene event_id'
    WHEN t.organizer_id IS NULL THEN 'PROBLEMA: no tiene organizer_id'
    ELSE 'OK'
  END as estado
FROM public.tables t
WHERE t.deleted_at IS NULL
LIMIT 20;

-- QUERY 6: Cuántas mesas tiene organizer_id = NULL
SELECT COUNT(*) as mesas_sin_organizer 
FROM public.tables 
WHERE organizer_id IS NULL AND deleted_at IS NULL;

-- QUERY 7: Ver schema de layout_settings
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'layout_settings' AND table_schema = 'public'
ORDER BY ordinal_position;
