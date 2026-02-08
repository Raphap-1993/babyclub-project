-- =========================================================
-- DIAGNOSTIC QUERIES - Run each one separately in Supabase
-- =========================================================

-- Query 1: Check current schema of 'tables' table
DESC public.tables;
-- or if DESC doesn't work, use:
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tables' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Query 2: Check if organizer_id column exists and has NULLs
SELECT 
  COUNT(*) as total_rows,
  COUNT(organizer_id) as rows_with_organizer_id,
  COUNT(*) - COUNT(organizer_id) as rows_with_null_organizer_id
FROM public.tables;

-- Query 3: Check tables without event_id
SELECT COUNT(*) as tables_without_event_id
FROM public.tables
WHERE event_id IS NULL;

-- Query 4: Check events and their organizers
SELECT 
  e.id as event_id,
  e.name as event_name,
  e.organizer_id,
  COUNT(t.id) as table_count
FROM public.events e
LEFT JOIN public.tables t ON e.id = t.event_id AND t.deleted_at IS NULL
GROUP BY e.id, e.name, e.organizer_id
ORDER BY e.created_at DESC;

-- Query 5: Check organizers
SELECT id, slug, name, is_active FROM public.organizers;

-- Query 6: Find problematic tables (event_id pointing to non-existent or NULL organizer)
SELECT 
  t.id,
  t.name,
  t.event_id,
  t.organizer_id,
  e.organizer_id as event_organizer_id,
  CASE 
    WHEN e.id IS NULL THEN 'Event does not exist'
    WHEN e.organizer_id IS NULL THEN 'Event has no organizer'
    WHEN t.organizer_id IS NULL THEN 'Table has NULL organizer'
    WHEN t.organizer_id != e.organizer_id THEN 'Mismatch organizer'
    ELSE 'OK'
  END as issue
FROM public.tables t
LEFT JOIN public.events e ON t.event_id = e.id
WHERE t.deleted_at IS NULL
ORDER BY CASE 
    WHEN e.id IS NULL THEN 1
    WHEN e.organizer_id IS NULL THEN 2
    WHEN t.organizer_id IS NULL THEN 3
    WHEN t.organizer_id != e.organizer_id THEN 4
    ELSE 5
  END;

-- Query 7: Check layout_settings table schema
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'layout_settings' AND table_schema = 'public'
ORDER BY ordinal_position;
