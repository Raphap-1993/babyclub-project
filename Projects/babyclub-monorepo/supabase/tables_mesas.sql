create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
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
  event_id uuid references public.events(id),
  full_name text not null,
  email text,
  phone text,
  voucher_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  codes text[] default '{}',
  notes text,
  ticket_id uuid references public.tickets(id),
  created_by_staff_id uuid references public.staff(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
