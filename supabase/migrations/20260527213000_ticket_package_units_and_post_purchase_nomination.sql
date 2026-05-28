-- Base contract for ticket package purchases with post-purchase nomination.
-- table_reservations stays as the commercial header; ticket_reservation_units
-- becomes the per-QR unit lifecycle without changing legacy attendees.

create extension if not exists pgcrypto;

do $$
declare
  v_event_id_type text;
  v_reservation_id_type text;
  v_has_ticket_quantity boolean;
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

  select format_type(a.atttypid, a.atttypmod)
    into v_reservation_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'table_reservations'
    and a.attname = 'id'
    and not a.attisdropped;

  if v_reservation_id_type is null then
    raise exception 'public.table_reservations.id column not found';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'table_reservations'
      and column_name = 'ticket_quantity'
  )
    into v_has_ticket_quantity;

  alter table public.table_reservations
    add column if not exists package_quantity integer,
    add column if not exists total_ticket_units integer;

  update public.table_reservations
  set package_quantity = 1
  where package_quantity is null;

  if v_has_ticket_quantity then
    update public.table_reservations
    set total_ticket_units =
      greatest(coalesce(ticket_quantity, 1), 1) * coalesce(package_quantity, 1)
    where total_ticket_units is null;
  else
    update public.table_reservations
    set total_ticket_units = coalesce(package_quantity, 1)
    where total_ticket_units is null;
  end if;

  alter table public.table_reservations
    alter column package_quantity set default 1;

  alter table public.table_reservations
    alter column package_quantity set not null;

  alter table public.table_reservations
    alter column total_ticket_units set default 1;

  alter table public.table_reservations
    alter column total_ticket_units set not null;

  alter table public.table_reservations
    drop constraint if exists table_reservations_package_quantity_check;

  alter table public.table_reservations
    add constraint table_reservations_package_quantity_check
    check (package_quantity >= 1);

  alter table public.table_reservations
    drop constraint if exists table_reservations_total_ticket_units_check;

  alter table public.table_reservations
    add constraint table_reservations_total_ticket_units_check
    check (total_ticket_units >= 1);

  execute format(
    $sql$
      create table if not exists public.ticket_reservation_units (
        id uuid primary key default gen_random_uuid(),
        event_id %1$s not null references public.events(id) on delete cascade,
        reservation_id %2$s not null references public.table_reservations(id) on delete cascade,
        unit_number integer not null,
        package_index integer not null,
        unit_index_in_package integer not null,
        status text not null default 'pending_nomination',
        qr_token text null,
        nomination_snapshot jsonb null,
        metadata jsonb not null default '{}'::jsonb,
        nominated_at timestamptz null,
        issued_at timestamptz null,
        used_at timestamptz null,
        cancelled_at timestamptz null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz null,
        constraint ticket_reservation_units_unit_number_check
          check (unit_number >= 1),
        constraint ticket_reservation_units_package_index_check
          check (package_index >= 1),
        constraint ticket_reservation_units_unit_index_in_package_check
          check (unit_index_in_package >= 1),
        constraint ticket_reservation_units_status_check
          check (status in ('pending_nomination', 'nominated', 'issued', 'used', 'cancelled')),
        constraint ticket_reservation_units_nomination_gate_check
          check (
            status in ('pending_nomination', 'cancelled')
            or nomination_snapshot is not null
          ),
        constraint ticket_reservation_units_qr_gate_check
          check (qr_token is null or status in ('issued', 'used', 'cancelled')),
        constraint ticket_reservation_units_issue_gate_check
          check (status not in ('issued', 'used') or qr_token is not null),
        constraint ticket_reservation_units_nomination_snapshot_check
          check (nomination_snapshot is null or jsonb_typeof(nomination_snapshot) = 'object'),
        constraint ticket_reservation_units_metadata_object_check
          check (jsonb_typeof(metadata) = 'object')
      )
    $sql$,
    v_event_id_type,
    v_reservation_id_type
  );
end $$;

create unique index if not exists ticket_reservation_units_reservation_unit_uidx
  on public.ticket_reservation_units(reservation_id, unit_number)
  where deleted_at is null;

create unique index if not exists ticket_reservation_units_reservation_slot_uidx
  on public.ticket_reservation_units(
    reservation_id,
    package_index,
    unit_index_in_package
  )
  where deleted_at is null;

create unique index if not exists ticket_reservation_units_event_qr_uidx
  on public.ticket_reservation_units(event_id, qr_token)
  where deleted_at is null
    and qr_token is not null;

create index if not exists ticket_reservation_units_reservation_status_idx
  on public.ticket_reservation_units(reservation_id, status)
  where deleted_at is null;

create index if not exists ticket_reservation_units_event_status_idx
  on public.ticket_reservation_units(event_id, status)
  where deleted_at is null;

comment on column public.table_reservations.package_quantity is
  'Number of sellable packages purchased in the reservation header.';

comment on column public.table_reservations.total_ticket_units is
  'Historical total of individual units derived from ticket_quantity * package_quantity.';

comment on table public.ticket_reservation_units is
  'One row per individual ticket unit/QR derived from a reservation header. Units start pending_nomination and QR issuance/use is gated by nomination.';

comment on column public.ticket_reservation_units.status is
  'Lifecycle state for the individual unit: pending_nomination, nominated, issued, used or cancelled.';

comment on column public.ticket_reservation_units.nomination_snapshot is
  'Named attendee snapshot for the unit once nomination happens. Legacy attendees on table_reservations still coexist for compatibility.';

comment on column public.ticket_reservation_units.metadata is
  'Base package math metadata for the unit, including package slots derived from the reservation header.';

comment on column public.ticket_reservation_units.qr_token is
  'Per-unit QR token. Must remain null until the unit reaches an issuable state after nomination.';
