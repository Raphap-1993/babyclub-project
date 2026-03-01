-- Store commercial context for ticket-only reservations.
-- This enables door scanning to show explicit QR type labels (EARLY/ALL NIGHT/table).

alter table if exists public.table_reservations
  add column if not exists sale_origin text,
  add column if not exists ticket_pricing_phase text null;

update public.table_reservations
set sale_origin = case when table_id is null then 'ticket' else 'table' end
where sale_origin is null;

alter table if exists public.table_reservations
  alter column sale_origin set default 'table';

alter table if exists public.table_reservations
  alter column sale_origin set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'table_reservations_sale_origin_check'
      and conrelid = 'public.table_reservations'::regclass
  ) then
    alter table public.table_reservations
      add constraint table_reservations_sale_origin_check
      check (sale_origin in ('table', 'ticket'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'table_reservations_ticket_pricing_phase_check'
      and conrelid = 'public.table_reservations'::regclass
  ) then
    alter table public.table_reservations
      add constraint table_reservations_ticket_pricing_phase_check
      check (ticket_pricing_phase in ('early_bird', 'all_night'));
  end if;
end $$;

create index if not exists table_reservations_sale_origin_idx
  on public.table_reservations(sale_origin)
  where deleted_at is null;

create index if not exists table_reservations_ticket_phase_idx
  on public.table_reservations(ticket_pricing_phase)
  where deleted_at is null and ticket_pricing_phase is not null;

comment on column public.table_reservations.sale_origin is
  'Commercial source of reservation. table: mesa/box flow, ticket: ticket-only flow.';

comment on column public.table_reservations.ticket_pricing_phase is
  'Ticket pricing phase used in ticket-only flow (early_bird or all_night).';
