create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  ticket_count integer not null default 4,
  min_consumption numeric,
  price numeric,
  pos_x numeric,
  pos_y numeric,
  pos_w numeric,
  pos_h numeric,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.table_reservations (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id),
  full_name text not null,
  email text,
  phone text,
  voucher_url text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  codes text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
