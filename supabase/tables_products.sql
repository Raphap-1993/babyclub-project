-- Tabla de productos/packs por mesa
create table if not exists public.table_products (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  name text not null,
  description text,
  items text[] default '{}',
  price numeric,
  cost_price numeric,
  tickets_included integer,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Relación opcional en reservas
alter table if exists public.table_reservations
  add column if not exists product_id uuid references public.table_products(id);

-- Permisos service_role
alter table public.table_products enable row level security;
create policy table_products_service_role_all
  on public.table_products
  for all
  to service_role
  using (true)
  with check (true);
