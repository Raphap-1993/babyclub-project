-- One-shot quickfix for schema drift (safe to re-run).
-- Use in Supabase SQL Editor when local app fails with:
-- "column <table>.deleted_at does not exist"

-- Soft-delete columns
alter table if exists public.events add column if not exists deleted_at timestamptz null;
alter table if exists public.events add column if not exists deleted_by uuid null;
alter table if exists public.events add column if not exists is_active boolean not null default true;

alter table if exists public.tickets add column if not exists deleted_at timestamptz null;
alter table if exists public.tickets add column if not exists deleted_by uuid null;
alter table if exists public.tickets add column if not exists is_active boolean not null default true;

alter table if exists public.codes add column if not exists deleted_at timestamptz null;
alter table if exists public.codes add column if not exists deleted_by uuid null;
alter table if exists public.codes add column if not exists is_active boolean not null default true;

alter table if exists public.tables add column if not exists deleted_at timestamptz null;
alter table if exists public.tables add column if not exists deleted_by uuid null;
alter table if exists public.tables add column if not exists is_active boolean not null default true;

alter table if exists public.table_products add column if not exists deleted_at timestamptz null;
alter table if exists public.table_products add column if not exists deleted_by uuid null;
alter table if exists public.table_products add column if not exists is_active boolean not null default true;

alter table if exists public.table_reservations add column if not exists deleted_at timestamptz null;
alter table if exists public.table_reservations add column if not exists deleted_by uuid null;
alter table if exists public.table_reservations add column if not exists is_active boolean not null default true;

alter table if exists public.promoters add column if not exists deleted_at timestamptz null;
alter table if exists public.promoters add column if not exists deleted_by uuid null;
alter table if exists public.promoters add column if not exists is_active boolean not null default true;

alter table if exists public.code_batches add column if not exists deleted_at timestamptz null;
alter table if exists public.code_batches add column if not exists deleted_by uuid null;
alter table if exists public.code_batches add column if not exists is_active boolean not null default true;

alter table if exists public.staff add column if not exists deleted_at timestamptz null;
alter table if exists public.staff add column if not exists deleted_by uuid null;
alter table if exists public.staff add column if not exists is_active boolean not null default true;

-- Ensure brand/layout tables exist (+ soft-delete fields)
create table if not exists public.brand_settings (
  id integer primary key default 1,
  logo_url text,
  updated_at timestamptz default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  is_active boolean not null default true
);

create table if not exists public.layout_settings (
  id integer primary key default 1,
  layout_url text,
  updated_at timestamptz default now(),
  deleted_at timestamptz null,
  deleted_by uuid null,
  is_active boolean not null default true
);

insert into public.brand_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.layout_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.brand_settings enable row level security;
alter table public.layout_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='brand_settings' and policyname='brand_settings_service_role_all'
  ) then
    create policy brand_settings_service_role_all
      on public.brand_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='layout_settings' and policyname='layout_settings_service_role_all'
  ) then
    create policy layout_settings_service_role_all
      on public.layout_settings
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Useful indexes
create index if not exists idx_events_deleted_at on public.events (deleted_at);
create index if not exists idx_codes_deleted_at on public.codes (deleted_at);
create index if not exists idx_tickets_deleted_at on public.tickets (deleted_at);
create index if not exists idx_tables_deleted_at on public.tables (deleted_at);
create index if not exists idx_table_products_deleted_at on public.table_products (deleted_at);
create index if not exists idx_table_reservations_deleted_at on public.table_reservations (deleted_at);
create index if not exists idx_promoters_deleted_at on public.promoters (deleted_at);
create index if not exists idx_code_batches_deleted_at on public.code_batches (deleted_at);
create index if not exists idx_staff_deleted_at on public.staff (deleted_at);
