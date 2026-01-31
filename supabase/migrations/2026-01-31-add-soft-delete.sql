-- Add soft delete columns (non-destructive)

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

alter table if exists public.brand_settings add column if not exists deleted_at timestamptz null;
alter table if exists public.brand_settings add column if not exists deleted_by uuid null;
alter table if exists public.brand_settings add column if not exists is_active boolean not null default true;

alter table if exists public.layout_settings add column if not exists deleted_at timestamptz null;
alter table if exists public.layout_settings add column if not exists deleted_by uuid null;
alter table if exists public.layout_settings add column if not exists is_active boolean not null default true;

alter table if exists public.staff add column if not exists deleted_at timestamptz null;
alter table if exists public.staff add column if not exists deleted_by uuid null;
alter table if exists public.staff add column if not exists is_active boolean not null default true;

-- Indexes for soft delete lookups
create index if not exists idx_events_deleted_at on public.events (deleted_at);
create index if not exists idx_codes_deleted_at on public.codes (deleted_at);
create index if not exists idx_tickets_deleted_at on public.tickets (deleted_at);
create index if not exists idx_tables_deleted_at on public.tables (deleted_at);
create index if not exists idx_table_products_deleted_at on public.table_products (deleted_at);
create index if not exists idx_table_reservations_deleted_at on public.table_reservations (deleted_at);
create index if not exists idx_promoters_deleted_at on public.promoters (deleted_at);
create index if not exists idx_code_batches_deleted_at on public.code_batches (deleted_at);
create index if not exists idx_staff_deleted_at on public.staff (deleted_at);

create index if not exists idx_codes_event_deleted_at on public.codes (event_id, deleted_at);
create index if not exists idx_tickets_event_deleted_at on public.tickets (event_id, deleted_at);
create index if not exists idx_tables_event_deleted_at on public.tables (event_id, deleted_at);
create index if not exists idx_table_reservations_event_deleted_at on public.table_reservations (event_id, deleted_at);
