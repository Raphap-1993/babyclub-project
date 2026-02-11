-- Link tickets directly to table reservations for deterministic traceability.
-- This closes the parent/child reservation-ticket flow and avoids contact-based heuristics.

alter table public.tickets
  add column if not exists table_reservation_id uuid
  references public.table_reservations(id)
  on delete set null;

comment on column public.tickets.table_reservation_id is
  'Direct link to originating table reservation (parent/child ticket traceability).';

-- Ensure legacy environments also have table/product context columns in tickets.
alter table public.tickets
  add column if not exists table_id uuid;

alter table public.tickets
  add column if not exists product_id uuid;

do $$
begin
  if to_regclass('public.tables') is not null
    and not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_table_id_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_table_id_fkey
      foreign key (table_id) references public.tables(id) on delete set null;
  end if;

  if to_regclass('public.table_products') is not null
    and not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_product_id_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_product_id_fkey
      foreign key (product_id) references public.table_products(id) on delete set null;
  end if;
end $$;

-- Backfill from reservation table where reservation already points to a primary ticket.
update public.tickets t
set table_reservation_id = tr.id
from public.table_reservations tr
where tr.ticket_id = t.id
  and tr.deleted_at is null
  and t.table_reservation_id is null;

-- Backfill from code link (child tickets generated from reservation codes).
update public.tickets t
set table_reservation_id = c.table_reservation_id
from public.codes c
where t.code_id = c.id
  and c.table_reservation_id is not null
  and t.table_reservation_id is distinct from c.table_reservation_id;

-- Backfill table/product context for linked tickets where missing.
update public.tickets t
set
  table_id = coalesce(t.table_id, tr.table_id),
  product_id = coalesce(t.product_id, tr.product_id)
from public.table_reservations tr
where t.table_reservation_id = tr.id
  and tr.deleted_at is null
  and (t.table_id is null or t.product_id is null);

create index if not exists tickets_table_reservation_idx
  on public.tickets(table_reservation_id)
  where deleted_at is null and table_reservation_id is not null;

create index if not exists tickets_table_reservation_active_idx
  on public.tickets(table_reservation_id, is_active)
  where deleted_at is null and table_reservation_id is not null;
