-- Asegura que la tabla tables tenga columnas de posición para el plano
alter table if exists public.tables
  add column if not exists pos_x numeric,
  add column if not exists pos_y numeric,
  add column if not exists pos_w numeric,
  add column if not exists pos_h numeric;

-- Opcional: valores por defecto para tamaño inicial (ancho/alto)
update public.tables
set
  pos_w = coalesce(pos_w, 12),
  pos_h = coalesce(pos_h, 8)
where true;
