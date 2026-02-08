-- Agrega soporte para reservas creadas desde backoffice y menor fricción en captura manual.

-- Nuevos vínculos y metadatos
alter table public.table_reservations
  add column if not exists event_id uuid references public.events(id);

alter table public.table_reservations
  add column if not exists created_by_staff_id uuid references public.staff(id);

alter table public.table_reservations
  add column if not exists ticket_id uuid references public.tickets(id);

alter table public.table_reservations
  add column if not exists notes text;

-- Permitir reservas sin voucher (caso manual)
alter table public.table_reservations
  alter column voucher_url drop not null;

-- Relleno inicial de event_id desde la mesa asociada
update public.table_reservations tr
set event_id = t.event_id
from public.tables t
where tr.table_id = t.id
  and tr.event_id is null
  and t.event_id is not null;

-- Índices útiles para filtros en panel
create index if not exists table_reservations_table_id_idx on public.table_reservations(table_id);
create index if not exists table_reservations_event_id_idx on public.table_reservations(event_id);
create index if not exists table_reservations_ticket_id_idx on public.table_reservations(ticket_id);
create index if not exists table_reservations_created_by_staff_id_idx on public.table_reservations(created_by_staff_id);

