-- Promoter settlement ledger.
-- Stores the operational act of paying cash or delivering benefits after the
-- promoter settlement report calculates eligible items.

create extension if not exists pgcrypto;

create table if not exists public.promoter_settlements (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  promoter_id text not null,
  organizer_id text null,
  event_name text null,
  promoter_name text null,
  promoter_code text null,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'paid', 'delivered', 'closed', 'void')),
  currency_code text not null default 'PEN',
  cash_unit_amount_cents integer not null default 0 check (cash_unit_amount_cents >= 0),
  cash_units integer not null default 0 check (cash_units >= 0),
  cash_total_cents integer not null default 0 check (cash_total_cents >= 0),
  drink_units numeric(10, 2) not null default 0 check (drink_units >= 0),
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_staff_id text null,
  settled_by_staff_id text null,
  settled_at timestamptz null,
  voided_by_staff_id text null,
  voided_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by text null
);

create table if not exists public.promoter_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.promoter_settlements(id) on delete cascade,
  source_type text not null check (source_type in ('ticket', 'reservation', 'manual')),
  source_id text not null,
  event_id text not null,
  promoter_id text not null,
  attendee_name text null,
  attendee_document text null,
  access_kind text null,
  reward_kind text not null default 'cash'
    check (reward_kind in ('cash', 'drink', 'mixed', 'manual')),
  cash_amount_cents integer not null default 0 check (cash_amount_cents >= 0),
  drink_units numeric(10, 2) not null default 0 check (drink_units >= 0),
  used_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  deleted_by text null
);

create index if not exists promoter_settlements_event_promoter_idx
  on public.promoter_settlements(event_id, promoter_id, created_at desc)
  where deleted_at is null;

create index if not exists promoter_settlements_status_idx
  on public.promoter_settlements(status, created_at desc)
  where deleted_at is null;

create index if not exists promoter_settlement_items_settlement_idx
  on public.promoter_settlement_items(settlement_id)
  where deleted_at is null;

create index if not exists promoter_settlement_items_event_promoter_idx
  on public.promoter_settlement_items(event_id, promoter_id)
  where deleted_at is null;

create unique index if not exists promoter_settlement_items_source_uidx
  on public.promoter_settlement_items(source_type, source_id)
  where deleted_at is null and is_active = true and source_type <> 'manual';

comment on table public.promoter_settlements is
  'Operational settlement header for promoter cash/benefit liquidation.';

comment on table public.promoter_settlement_items is
  'Tickets or reservations included in a promoter settlement. Unique source prevents double liquidation.';
