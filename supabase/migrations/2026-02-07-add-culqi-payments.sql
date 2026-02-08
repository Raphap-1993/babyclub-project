-- Payments foundation for Culqi integration
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('culqi')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'expired', 'canceled')),
  order_id text unique,
  charge_id text unique,
  event_id uuid references public.events(id),
  reservation_id uuid references public.table_reservations(id),
  amount integer not null check (amount >= 0),
  currency_code text not null default 'PEN',
  customer_email text,
  customer_name text,
  customer_phone text,
  idempotency_key text unique,
  receipt_number text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_event_id_idx on public.payments(event_id);
create index if not exists payments_reservation_id_idx on public.payments(reservation_id);
create index if not exists payments_created_at_idx on public.payments(created_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('culqi')),
  event_name text,
  event_key text not null unique,
  signature text,
  payload jsonb not null,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'error')),
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_webhook_events_provider_created_idx on public.payment_webhook_events(provider, created_at desc);
