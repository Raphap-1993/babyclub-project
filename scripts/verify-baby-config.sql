-- Script para verificar configuración del organizador BABY
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar datos del organizador BABY
SELECT 
  id,
  name,
  slug,
  layout_url,
  created_at
FROM organizers
WHERE id = '04831d27-5b06-48f5-b553-fbb62e04af52';

-- 2. Verificar mesas del organizador BABY
SELECT 
  t.id,
  t.name,
  t.event_id,
  e.name as event_name,
  t.organizer_id,
  t.layout_x,
  t.layout_y,
  t.layout_size,
  t.ticket_count,
  t.price
FROM tables t
LEFT JOIN events e ON e.id = t.event_id
WHERE t.organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'
  AND t.deleted_at IS NULL
ORDER BY e.name, t.name;

-- 3. Verificar eventos activos de BABY
SELECT 
  id,
  name,
  organizer_id,
  is_active,
  starts_at,
  location
FROM events
WHERE organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'
  AND deleted_at IS NULL
ORDER BY starts_at DESC;

-- 4. Verificar si hay layout_settings (tabla nueva, no debería usarse por ahora)
SELECT * FROM layout_settings 
WHERE organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'
LIMIT 5;
