-- Permitir mesas sin evento (mantiene columna pero ya no es obligatoria)
alter table public.tables alter column event_id drop not null;
-- Opcional: si quieres limpiar constraint, deja la FK pero acepta nulls

-- Opcional: mover data existente si necesitas, aquí solo habilitamos nulls.
