-- Tabla de branding (aplicar en Supabase manualmente)
create table if not exists public.brand_settings (
  id integer primary key default 1,
  logo_url text,
  updated_at timestamptz default now()
);

alter table public.brand_settings enable row level security;
create policy brand_settings_service_role_all
  on public.brand_settings
  for all
  using (true)
  with check (true)
  to service_role;
