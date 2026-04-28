-- Normalize public ticket types per event.
-- Keeps legacy events.* price columns as compatibility input, but makes the
-- sellable ticket options first-class rows.

do $$
declare
  v_event_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_event_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'events'
    and a.attname = 'id'
    and not a.attisdropped;

  if v_event_id_type is null then
    raise exception 'public.events.id column not found';
  end if;

  execute format(
    $sql$
      create table if not exists public.event_ticket_types (
        id uuid primary key default gen_random_uuid(),
        event_id %s not null references public.events(id) on delete cascade,
        code text not null,
        label text not null,
        description text null,
        sale_phase text not null check (sale_phase in ('early_bird', 'all_night')),
        ticket_quantity integer not null check (ticket_quantity > 0),
        price numeric(10, 2) not null check (price > 0),
        currency_code text not null default 'PEN',
        is_active boolean not null default true,
        sort_order integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz null
      )
    $sql$,
    v_event_id_type
  );
end $$;

create unique index if not exists event_ticket_types_event_code_uidx
  on public.event_ticket_types(event_id, code);

create index if not exists event_ticket_types_event_active_idx
  on public.event_ticket_types(event_id, is_active, sort_order)
  where deleted_at is null;

alter table if exists public.table_reservations
  add column if not exists ticket_type_id uuid null references public.event_ticket_types(id) on delete set null,
  add column if not exists ticket_type_code text null,
  add column if not exists ticket_type_label text null,
  add column if not exists ticket_unit_price numeric(10, 2) null,
  add column if not exists ticket_total_amount numeric(10, 2) null;

create index if not exists table_reservations_ticket_type_idx
  on public.table_reservations(ticket_type_id)
  where deleted_at is null and ticket_type_id is not null;

insert into public.event_ticket_types (
  event_id,
  code,
  label,
  description,
  sale_phase,
  ticket_quantity,
  price,
  is_active,
  sort_order
)
select
  e.id,
  seed.code,
  seed.label,
  seed.description,
  seed.sale_phase,
  seed.ticket_quantity,
  seed.price,
  seed.is_active,
  seed.sort_order
from public.events e
cross join lateral (
  values
    (
      'early_bird_1',
      '1 QR EARLY BABY',
      'Incluye 1 trago de cortesia',
      'early_bird',
      1,
      case when e.early_bird_price_1 > 0 then e.early_bird_price_1 else 15 end::numeric(10, 2),
      coalesce(e.early_bird_enabled, false),
      10
    ),
    (
      'early_bird_2',
      '2 QR EARLY BABY',
      'Incluye 2 tragos de cortesia',
      'early_bird',
      2,
      case when e.early_bird_price_2 > 0 then e.early_bird_price_2 else 25 end::numeric(10, 2),
      coalesce(e.early_bird_enabled, false),
      20
    ),
    (
      'all_night_1',
      '1 QR ALL NIGHT',
      'Incluye 1 trago a eleccion',
      'all_night',
      1,
      case when e.all_night_price_1 > 0 then e.all_night_price_1 else 20 end::numeric(10, 2),
      true,
      30
    ),
    (
      'all_night_2',
      '2 QR ALL NIGHT',
      'Incluye 2 tragos a eleccion',
      'all_night',
      2,
      case when e.all_night_price_2 > 0 then e.all_night_price_2 else 35 end::numeric(10, 2),
      true,
      40
    )
) as seed(
  code,
  label,
  description,
  sale_phase,
  ticket_quantity,
  price,
  is_active,
  sort_order
)
on conflict do nothing;

comment on table public.event_ticket_types is
  'Sellable public ticket types per event, used by landing and ticket reservations.';
comment on column public.table_reservations.ticket_type_code is
  'Snapshot of the selected public ticket type code at reservation time.';
comment on column public.table_reservations.ticket_total_amount is
  'Snapshot total amount in currency units for ticket-only reservations.';
